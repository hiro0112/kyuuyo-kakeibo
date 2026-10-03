import { COLUMNS, columnLabel, yen } from '../lib/fiscal.js';
import { parseIncomePdf } from '../lib/api.js';
import { saveFile } from '../lib/files.js';
import { addIncomeImport, newId, payslipsToCells, removeIncomeImport, setIncomeCell } from '../lib/store.js';
import ImportedFiles from './ImportedFiles.jsx';
import NumberCell from './NumberCell.jsx';
import PdfUploader from './PdfUploader.jsx';

// ① 収入タブ：給与明細PDFの読み取り結果を月ごとに管理する
export default function IncomeTab({ state, setState, fy, setFy }) {
  const year = state.incomes[fy] ?? {};
  const get = (col, field) => year[col]?.[field] ?? 0;
  const total = (field) => COLUMNS.reduce((sum, c) => sum + get(c.key, field), 0);

  async function importPdf(file) {
    const { payslips } = await parseIncomePdf(file);
    const cells = payslipsToCells(payslips);
    if (cells.length === 0) throw new Error('給与明細を読み取れませんでした。');
    const importId = newId();
    // PDF本体はブラウザ内に保存する。保存に失敗しても読み取り結果は反映する
    await saveFile(importId, file).catch(() => {});
    setState((s) => addIncomeImport(s, importId, file.name, cells));
    // 読み取った明細の年度を表示する
    setFy(cells[cells.length - 1].fy);
    return cells
      .map((c) => `${c.fy}年度 ${columnLabel(c.col)}（収入 ${yen(c.gross)}円／控除 ${yen(c.deduction)}円）`)
      .join('、');
  }

  const rows = [
    { field: 'gross', label: '収入' },
    { field: 'deduction', label: '控除合計' },
  ];

  // 貼り付けたファイルごとの読み取り内容
  const files = state.incomeImports.map((i) => ({
    id: i.id,
    fileName: i.fileName,
    summary: i.cells.map((c) => `${c.fy}年度 ${columnLabel(c.col)}`).join('、'),
    content: (
      <table className="file-table">
        <thead>
          <tr>
            <th>対象</th>
            <th>収入</th>
            <th>控除合計</th>
            <th>手取り金額</th>
          </tr>
        </thead>
        <tbody>
          {i.cells.map((c) => (
            <tr key={`${c.fy}-${c.col}`}>
              <td>
                {c.fy}年度 {columnLabel(c.col)}
              </td>
              <td className="num">{yen(c.gross)}</td>
              <td className="num">{yen(c.deduction)}</td>
              <td className="num">{yen(c.gross - c.deduction)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  }));

  return (
    <>
      <PdfUploader label="給与明細" onFile={importPdf} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>項目</th>
              {COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>年度合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ field, label }) => (
              <tr key={field}>
                <th>{label}</th>
                {COLUMNS.map((c) => (
                  <td key={c.key}>
                    <NumberCell
                      value={get(c.key, field)}
                      onChange={(v) => setState((s) => setIncomeCell(s, fy, c.key, field, v))}
                    />
                  </td>
                ))}
                <td className="num total">{yen(total(field))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>手取り金額</th>
              {COLUMNS.map((c) => (
                <td key={c.key} className="num">
                  {yen(get(c.key, 'gross') - get(c.key, 'deduction'))}
                </td>
              ))}
              <td className="num total">{yen(total('gross') - total('deduction'))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint">収入・控除合計のセルは直接入力して修正できます。手取り金額は「収入 − 控除合計」で自動計算されます。</p>
      <ImportedFiles items={files} onDelete={(id) => setState((s) => removeIncomeImport(s, id))} />
    </>
  );
}
