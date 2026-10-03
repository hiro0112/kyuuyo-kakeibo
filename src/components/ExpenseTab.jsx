import { useMemo, useState } from 'react';
import { COLUMNS, yen } from '../lib/fiscal.js';
import { parseExpensePdf } from '../lib/api.js';
import { addCategory, addImportedTransactions, expenseTotals, removeImport, setExpenseCell } from '../lib/store.js';
import NumberCell from './NumberCell.jsx';
import PdfUploader from './PdfUploader.jsx';

// ② 支出タブ：支払明細PDFの読み取り結果をカテゴリ×月で管理する
export default function ExpenseTab({ state, setState, fy, setFy }) {
  const [newName, setNewName] = useState('');
  const totals = useMemo(() => expenseTotals(state.transactions, fy), [state.transactions, fy]);
  const cell = (categoryId, col) => totals[categoryId]?.[col] ?? 0;
  const rowTotal = (categoryId) => COLUMNS.reduce((sum, c) => sum + cell(categoryId, c.key), 0);
  const colTotal = (col) => state.categories.reduce((sum, cat) => sum + cell(cat.id, col), 0);
  const grandTotal = COLUMNS.reduce((sum, c) => sum + colTotal(c.key), 0);

  // 取り込み済みのPDF一覧（重複取り込みの確認と取り消し用）
  const imports = useMemo(() => {
    const map = new Map();
    for (const tx of state.transactions) {
      if (!tx.importId) continue;
      const entry = map.get(tx.importId) ?? { id: tx.importId, fileName: tx.sourceFile, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += tx.amount;
      map.set(tx.importId, entry);
    }
    return [...map.values()];
  }, [state.transactions]);

  async function importPdf(file) {
    if (imports.some((i) => i.fileName === file.name) && !confirm(`${file.name} は取り込み済みです。もう一度取り込みますか？`)) {
      throw new Error('取り込みを中止しました。');
    }
    const { transactions } = await parseExpensePdf(file, state.categories);
    const [, count] = addImportedTransactions(state, file.name, transactions);
    if (count === 0) throw new Error('支払明細を読み取れませんでした。');
    setState((s) => addImportedTransactions(s, file.name, transactions)[0]);
    // 最も明細が多い年度を表示する
    const years = {};
    for (const t of transactions) {
      const y = Number(t.date?.slice(0, 4));
      const m = Number(t.date?.slice(5, 7));
      if (y && m) years[m >= 4 ? y : y - 1] = (years[m >= 4 ? y : y - 1] ?? 0) + 1;
    }
    const top = Object.entries(years).sort((a, b) => b[1] - a[1])[0];
    if (top) setFy(Number(top[0]));
    return `${count}件の明細を取り込みました。`;
  }

  function addRow(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (state.categories.some((c) => c.name === name)) {
      alert(`「${name}」は既にあります。`);
      return;
    }
    setState((s) => addCategory(s, name));
    setNewName('');
  }

  return (
    <>
      <PdfUploader label="カード支払明細" onFile={importPdf} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>カテゴリ</th>
              {COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>年度合計</th>
            </tr>
          </thead>
          <tbody>
            {state.categories.map((cat) => (
              <tr key={cat.id}>
                <th>{cat.name}</th>
                {COLUMNS.map((c) => (
                  <td key={c.key}>
                    <NumberCell
                      value={cell(cat.id, c.key)}
                      onChange={(v) => setState((s) => setExpenseCell(s, fy, c.key, cat.id, v))}
                    />
                  </td>
                ))}
                <td className="num total">{yen(rowTotal(cat.id))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>合計</th>
              {COLUMNS.map((c) => (
                <td key={c.key} className="num">
                  {yen(colTotal(c.key))}
                </td>
              ))}
              <td className="num total">{yen(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <form className="inline-form" onSubmit={addRow}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="追加するカテゴリ名" />
        <button type="submit">＋ 行を追加</button>
      </form>
      <p className="hint">
        セルは直接入力して修正できます。修正した差額は「手動入力」として支出詳細タブに表示されます。
      </p>

      {imports.length > 0 && (
        <section>
          <h2>取り込み済みのPDF</h2>
          <ul className="import-list">
            {imports.map((i) => (
              <li key={i.id}>
                <span>
                  {i.fileName}（{i.count}件／{yen(i.amount)}円）
                </span>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm(`${i.fileName} から取り込んだ明細 ${i.count}件を削除しますか？`)) {
                      setState((s) => removeImport(s, i.id));
                    }
                  }}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
