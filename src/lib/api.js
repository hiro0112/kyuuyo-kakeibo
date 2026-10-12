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

// 開発中（npm run dev）は Vite が /api をサーバーに転送する。
// GitHub Pages で公開した画面からは、このPCで動かしているサーバーを直接呼ぶ
const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? '' : 'http://127.0.0.1:3001');

async function postPdf(path, file, extra = {}) {
  const data = await fileToBase64(file);
  let response;
  try {
    response = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, ...extra }),
    });
  } catch {
    throw new Error(
      'このPCの読み取りサーバーに接続できません。プロジェクトのフォルダで npm run server（または npm run dev）を実行してから、もう一度お試しください。',
    );
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
