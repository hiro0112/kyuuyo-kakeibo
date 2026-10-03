import { useEffect, useRef, useState } from 'react';

const isPdf = (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

// PDFの貼り付け欄。ドラッグ＆ドロップ・ファイル選択・Ctrl+V に対応する
// onFile(file) は読み取り結果のメッセージを返す（失敗時は例外を投げる）
export default function PdfUploader({ label, onFile }) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [logs, setLogs] = useState([]);
  const inputRef = useRef(null);
  const handleRef = useRef(null);

  async function handleFiles(fileList) {
    const files = [...fileList];
    if (busy || files.length === 0) return;
    setBusy(true);
    // 複数ファイルは1件ずつ順番に読み取る
    for (const file of files) {
      let entry;
      if (!isPdf(file)) {
        entry = { ok: false, text: `${file.name}：PDFファイルではありません。` };
      } else {
        try {
          entry = { ok: true, text: `${file.name}：${await onFile(file)}` };
        } catch (err) {
          entry = { ok: false, text: `${file.name}：${err.message}` };
        }
      }
      setLogs((prev) => [entry, ...prev].slice(0, 8));
    }
    setBusy(false);
  }
  handleRef.current = handleFiles;

  // クリップボードからのPDF貼り付け（Ctrl+V）
  useEffect(() => {
    const onPaste = (e) => {
      if (e.clipboardData?.files?.length) {
        e.preventDefault();
        handleRef.current(e.clipboardData.files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  return (
    <div className="uploader">
      <div
        className={`dropzone${dragging ? ' dragging' : ''}${busy ? ' busy' : ''}`}
        onClick={() => !busy && inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {busy ? 'Claudeが読み取り中です…' : `${label}のPDFをここにドロップ／クリックして選択／Ctrl+Vで貼り付け`}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {logs.length > 0 && (
        <ul className="upload-logs">
          {logs.map((log, i) => (
            <li key={i} className={log.ok ? 'ok' : 'ng'}>
              {log.ok ? '✓' : '✕'} {log.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
