// バックエンド（Node.js）経由でClaude APIにPDFを読み取らせる

// PDFファイルをbase64文字列に変換する
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('ファイルを読み込めませんでした。'));
    reader.readAsDataURL(file);
  });
}

async function postPdf(path, file, extra = {}) {
  const data = await fileToBase64(file);
  let response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, ...extra }),
    });
  } catch {
    throw new Error('サーバーに接続できません。npm run dev でサーバーが起動しているか確認してください。');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `サーバーエラー（${response.status}）`);
  }
  return body;
}

export const parseIncomePdf = (file) => postPdf('/api/parse-income', file);

export const parseExpensePdf = (file, categories) =>
  postPdf('/api/parse-expense', file, {
    categories: categories.map(({ name, keywords }) => ({ name, keywords })),
  });
