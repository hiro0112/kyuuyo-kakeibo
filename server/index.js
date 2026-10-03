// バックエンド：ブラウザから受け取ったPDFをClaude APIで読み取る
// APIキーはここ（サーバー側）だけで使い、ブラウザには渡さない
import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
const PORT = process.env.PORT || 3001;

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

const app = express();
app.use(express.json({ limit: '45mb' }));

// ブラウザに返すエラー（ステータスコード付き）
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// PDFとプロンプトをClaudeに渡し、スキーマどおりのJSONを受け取る
async function readPdfAsJson(pdfBase64, prompt, schema) {
  if (!client) {
    throw new HttpError(500, 'ANTHROPIC_API_KEY が設定されていません。.env にAPIキーを記載してサーバーを再起動してください。');
  }
  if (typeof pdfBase64 !== 'string' || !pdfBase64) {
    throw new HttpError(400, 'PDFデータがありません。');
  }

  // 明細行が多いと出力が長くなるため、ストリーミングで受け取る
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'max_tokens') {
    throw new HttpError(422, '明細の行数が多すぎて読み取りきれませんでした。PDFを分割して再度お試しください。');
  }
  if (message.stop_reason === 'refusal') {
    throw new HttpError(422, 'このPDFは読み取れませんでした。');
  }
  const text = message.content.find((block) => block.type === 'text')?.text;
  if (!text) {
    throw new HttpError(502, 'Claudeから読み取り結果が返りませんでした。');
  }
  return JSON.parse(text);
}

// ---- 給与明細の読み取り ----

const INCOME_SCHEMA = {
  type: 'object',
  properties: {
    payslips: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: '支給年（西暦）' },
          month: { type: 'integer', description: '支給月（1〜12）' },
          type: { type: 'string', enum: ['monthly', 'summerBonus', 'winterBonus'] },
          gross: { type: 'integer', description: '総支給額（円）' },
          deduction: { type: 'integer', description: '控除合計（円）' },
        },
        required: ['year', 'month', 'type', 'gross', 'deduction'],
        additionalProperties: false,
      },
    },
  },
  required: ['payslips'],
  additionalProperties: false,
};

const INCOME_PROMPT = `このPDFは給与明細または賞与明細です。明細1件ごとに以下を読み取ってください。

- year, month: 何年何月分の給与か（西暦）。「○年○月分」の記載を優先し、なければ支給日の年月を使う。和暦は西暦に直す。
- type: 月例給与は "monthly"、夏の賞与は "summerBonus"、冬の賞与は "winterBonus"。
- gross: 総支給額（支給合計）。円単位の整数。
- deduction: 控除合計（社会保険料・税金などの控除額の合計）。円単位の整数。

PDFに複数の明細が含まれる場合はすべて返してください。給与明細・賞与明細でない場合は payslips を空配列にしてください。
金額は明細に記載された数値をそのまま使い、推測で補わないでください。`;

app.post('/api/parse-income', async (req, res, next) => {
  try {
    res.json(await readPdfAsJson(req.body?.data, INCOME_PROMPT, INCOME_SCHEMA));
  } catch (err) {
    next(err);
  }
});

// ---- カード支払明細の読み取り・カテゴリ分類 ----

function expenseSchema(categoryNames) {
  return {
    type: 'object',
    properties: {
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: '利用日（YYYY-MM-DD）' },
            description: { type: 'string', description: '明細に記載された利用店名・支払い名目（そのまま）' },
            keyword: { type: 'string', description: 'descriptionに含まれる、店舗・サービスを識別できる短い部分文字列' },
            amount: { type: 'integer', description: '利用金額（円）。返金・値引きはマイナス' },
            category: { type: 'string', enum: categoryNames },
          },
          required: ['date', 'description', 'keyword', 'amount', 'category'],
          additionalProperties: false,
        },
      },
    },
    required: ['transactions'],
    additionalProperties: false,
  };
}

function expensePrompt(categories) {
  const rules = categories
    .map((c) => `- ${c.name}${c.keywords.length ? `：${c.keywords.join('、')}` : ''}`)
    .join('\n');
  return `このPDFはクレジットカード等の支払明細です。利用明細を1行ずつすべて読み取ってください。

- date: 利用日（支払日・引落日ではない）。YYYY-MM-DD形式。年が省略されている場合は明細の対象期間から判断する。
- description: 利用店名・支払い名目。明細の記載をそのまま使う。
- keyword: description に含まれる部分文字列のうち、店舗やサービスを識別できる短い名称（支店名・番号・日付などは除く）。必ず description の一部をそのまま抜き出すこと。
- amount: 利用金額。円単位の整数。返金・取消はマイナスにする。
- category: 下記のカテゴリから最も適切なものを1つ選ぶ。

合計・小計・前回繰越・支払総額などの集計行は含めないでください。
支払明細でない場合は transactions を空配列にしてください。

【カテゴリと分類ルール】
カテゴリ名の後ろに書かれた語句を含む明細は、必ずそのカテゴリに分類してください。
どれにも当てはまらない明細は、内容から最も近いカテゴリを選んでください。
${rules}`;
}

app.post('/api/parse-expense', async (req, res, next) => {
  try {
    const categories = (Array.isArray(req.body?.categories) ? req.body.categories : [])
      .filter((c) => c && typeof c.name === 'string' && c.name)
      .map((c) => ({ name: c.name, keywords: Array.isArray(c.keywords) ? c.keywords.map(String) : [] }));
    if (categories.length === 0) {
      throw new HttpError(400, 'カテゴリが1つもありません。');
    }
    const result = await readPdfAsJson(
      req.body?.data,
      expensePrompt(categories),
      expenseSchema(categories.map((c) => c.name)),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---- エラー処理 ----

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = 500;
  let message = '読み取り中にエラーが発生しました。';
  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
  } else if (err instanceof Anthropic.AuthenticationError) {
    message = 'Claude APIキーが正しくありません。.env の ANTHROPIC_API_KEY を確認してください。';
  } else if (err instanceof Anthropic.RateLimitError) {
    status = 429;
    message = 'Claude APIの利用制限に達しました。しばらく待ってから再度お試しください。';
  } else if (err instanceof Anthropic.APIConnectionError) {
    status = 502;
    message = 'Claude APIに接続できませんでした。ネットワークを確認してください。';
  } else if (err instanceof Anthropic.APIError) {
    status = 502;
    message = `Claude APIエラー: ${err.message}`;
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'PDFのサイズが大きすぎます（上限 約32MB）。';
  }
  // PDFの中身はログに出さない
  console.error(`[${req.method} ${req.path}] ${status} ${err?.name}: ${err?.message}`);
  res.status(status).json({ error: message });
});

// 外部から見られないよう、自分のPC（localhost）からの接続だけ受け付ける
app.listen(PORT, '127.0.0.1', () => {
  console.log(`APIサーバー起動: http://127.0.0.1:${PORT}`);
  if (!client) console.warn('警告: ANTHROPIC_API_KEY が未設定です。.env を作成してください。');
});
