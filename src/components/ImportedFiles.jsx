// 貼り付けたファイルの一覧。全体が折り畳みで、最初は閉じている
// 開くとファイル名が1行ずつ並び、それぞれ削除できる
// items: [{ id, fileName, summary }]
export default function ImportedFiles({ items, onDelete }) {
  return (
    <details className="file-list">
      <summary>貼り付けたファイル（{items.length}件）</summary>
      {items.length === 0 ? (
        <p className="hint">貼り付けたファイルはありません。</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span className="file-name">{item.fileName}</span>
              <span className="muted">{item.summary}</span>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (confirm(`${item.fileName} を削除しますか？\nこのファイルから読み取ったデータも表から削除されます。`)) {
                    onDelete(item.id);
                  }
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
