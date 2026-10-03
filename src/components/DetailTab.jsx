import { useEffect, useState } from 'react';
import { columnLabel, yen } from '../lib/fiscal.js';

// ④ 支出詳細タブ：選択した期間の支出を、カテゴリごとに明細1行ずつ表示する（入力不可）
export default function DetailTab({ state, fy }) {
  const [from, setFrom] = useState(`${fy}-04-01`);
  const [to, setTo] = useState(`${fy + 1}-03-31`);

  // 年度を切り替えたら、期間をその年度全体に戻す
  useEffect(() => {
    setFrom(`${fy}-04-01`);
    setTo(`${fy + 1}-03-31`);
  }, [fy]);

  const inRange = state.transactions
    .filter((tx) => (!from || tx.date >= from) && (!to || tx.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date));
  const groups = state.categories
    .map((cat) => ({ cat, items: inRange.filter((tx) => tx.categoryId === cat.id) }))
    .filter((g) => g.items.length > 0);
  const sum = (items) => items.reduce((acc, tx) => acc + tx.amount, 0);

  return (
    <>
      <div className="inline-form">
        <label>
          期間
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <span>〜</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <strong className="period-total">
          合計 {yen(sum(inRange))}円（{inRange.length}件）
        </strong>
      </div>

      {groups.length === 0 ? (
        <p className="hint">この期間の支出はありません。</p>
      ) : (
        <div className="table-wrap">
          <table className="detail">
            <thead>
              <tr>
                <th>利用日</th>
                <th>支払い名目</th>
                <th>金額</th>
                <th>取り込み元</th>
              </tr>
            </thead>
            {groups.map(({ cat, items }) => (
              <tbody key={cat.id}>
                <tr className="group-row">
                  <th colSpan={2}>
                    {cat.name}（{items.length}件）
                  </th>
                  <td className="num">{yen(sum(items))}</td>
                  <td />
                </tr>
                {items.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.manual ? columnLabel(tx.col) : tx.date}</td>
                    <td>{tx.description}</td>
                    <td className="num">{yen(tx.amount)}</td>
                    <td className="muted">{tx.manual ? '支出タブで入力' : tx.sourceFile}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </>
  );
}
