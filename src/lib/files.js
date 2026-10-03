// 貼り付けたPDFファイル本体の保存先（ブラウザ内の IndexedDB）
// ローカルストレージは容量が小さいため、ファイル本体だけこちらに保存する。外部には送らない
const DB_NAME = 'kyuyo-kakeibo-files';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// 取り込みIDをキーにしてPDFを保存する
export const saveFile = (id, file) => run('readwrite', (store) => store.put(file, id));

// 保存済みのPDFを取り出す。なければ undefined
export const loadFile = (id) => run('readonly', (store) => store.get(id));

export const deleteFile = (id) => run('readwrite', (store) => store.delete(id));
