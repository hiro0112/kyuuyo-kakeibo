import { useEffect, useState } from 'react';
import { deleteFile, loadFile } from '../lib/files.js';

// 保存しておいたPDFを表示する。開かれたときに初めて読み込む
function PdfPreview({ id }) {
  const [url, setUrl] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    loadFile(id)
      .then((file) => {
        if (cancelled) return;
        if (!file) {
          setMissing(true);
          return;
        }
        // application/pdf を明示しないとブラウザ内で表示されないことがある
        objectUrl = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }));
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (missing) return <p className="hint">このファイルのPDF本体は保存されていません。</p>;
  if (!url) return <p className="hint">PDFを読み込み中…</p>;
  return <iframe className="pdf-preview" src={url} title="貼り付けたPDF" />;
}

function FileItem({ item, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <details className="file-item" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="file-name">{item.fileName}</span>
        <span className="muted">{item.summary}</span>
        <button
          type="button"
          className="danger"
          onClick={(e) => {
            // 削除ボタンでは折り畳みを開閉しない
            e.preventDefault();
            if (confirm(`${item.fileName} を削除しますか？\nこのファイルから読み取ったデータも表から削除されます。`)) {
              deleteFile(item.id).catch(() => {});
              onDelete(item.id);
            }
          }}
        >
          削除
        </button>
      </summary>
      {open && (
        <div className="file-body">
          {item.content}
          <PdfPreview id={item.id} />
        </div>
      )}
    </details>
  );
}

// 貼り付けたファイルの一覧。1件ずつ折り畳みで、最初は閉じている
// items: [{ id, fileName, summary, content }]
export default function ImportedFiles({ items, onDelete }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2>貼り付けたファイル</h2>
      {items.map((item) => (
        <FileItem key={item.id} item={item} onDelete={onDelete} />
      ))}
    </section>
  );
}
