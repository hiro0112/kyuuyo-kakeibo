import { useEffect, useState } from 'react';
import { currentFiscalYear } from './lib/fiscal.js';
import { loadState, saveState } from './lib/store.js';
import IncomeTab from './components/IncomeTab.jsx';
import ExpenseTab from './components/ExpenseTab.jsx';
import SummaryTab from './components/SummaryTab.jsx';
import DetailTab from './components/DetailTab.jsx';
import CategoryTab from './components/CategoryTab.jsx';

const TABS = [
  { key: 'income', label: '① 収入', component: IncomeTab },
  { key: 'expense', label: '② 支出', component: ExpenseTab },
  { key: 'summary', label: '③ 収入−支出', component: SummaryTab },
  { key: 'detail', label: '④ 支出詳細', component: DetailTab },
  { key: 'category', label: '⑤ カテゴリ', component: CategoryTab },
];

export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('income');
  const [fy, setFy] = useState(currentFiscalYear);

  // 変更のたびにローカルストレージへ保存する（リロードしても消えない）
  useEffect(() => saveState(state), [state]);

  const Active = TABS.find((t) => t.key === tab).component;

  return (
    <div className="app">
      <header>
        <h1>給与・家計簿</h1>
        <div className="fy-switch">
          <button type="button" onClick={() => setFy(fy - 1)} aria-label="前の年度">
            ‹
          </button>
          <strong>{fy}年度</strong>
          <button type="button" onClick={() => setFy(fy + 1)} aria-label="次の年度">
            ›
          </button>
        </div>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={t.key === tab ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        <Active state={state} setState={setState} fy={fy} setFy={setFy} />
      </main>
    </div>
  );
}
