import { useMemo } from 'react';
import { COLUMNS, yen } from '../lib/fiscal.js';
import { expenseTotals } from '../lib/store.js';

// ③ 収入−支出タブ：①②の内容から残金額を自動計算する（入力不可）
export default function SummaryTab({ state, fy }) {
  const totals = useMemo(() => expenseTotals(state.transactions, fy), [state.transactions, fy]);
  const year = state.incomes[fy] ?? {};

  const gross = (col) => year[col]?.gross ?? 0;
  const deduction = (col) => year[col]?.deduction ?? 0;
  const net = (col) => gross(col) - deduction(col);
  const expense = (col) => Object.values(totals).reduce((sum, row) => sum + (row[col] ?? 0), 0);
  const balance = (col) => net(col) - expense(col);

  const rows = [
    { label: '収入', value: gross },
    { label: '控除', value: deduction },
    { label: '手取り金額', value: net },
    { label: '支出', value: expense },
    { label: '残金額', value: balance, emphasis: true },
  ];

  return (
    <>
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
            {rows.map((row) => {
              const sum = COLUMNS.reduce((acc, c) => acc + row.value(c.key), 0);
              const cls = (v) => `num${row.emphasis && v < 0 ? ' negative' : ''}`;
              return (
                <tr key={row.label} className={row.emphasis ? 'emphasis' : ''}>
                  <th>{row.label}</th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={cls(row.value(c.key))}>
                      {yen(row.value(c.key))}
                    </td>
                  ))}
                  <td className={`${cls(sum)} total`}>{yen(sum)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">この表は収入タブ・支出タブの内容から自動計算されます。残金額 ＝ 手取り金額 − 支出。</p>
    </>
  );
}
