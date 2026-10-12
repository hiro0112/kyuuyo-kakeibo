import { useEffect, useState } from 'react';
import { currentFiscalYear } from './lib/fiscal.js';
import { loadState, parseState, saveState } from './lib/store.js';
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

  // データはブラウザごと・URLごとに別なので、ファイルに書き出して別の場所へ移せるようにする
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kyuyo-kakeibo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file) {
    let loaded = null;
    try {
      loaded = parseState(await file.text());
    } catch {
      // 下のメッセージで知らせる
    }
    if (!loaded) {
      alert('このファイルは読み込めません。このアプリで書き出したファイルを選んでください。');
      return;
    }
    if (confirm('現在のデータを、選んだファイルの内容で置き換えますか？')) setState(loaded);
  }

  return (
    <div className="app">
      <header>
        <h1>給与・家計簿</h1>
        <div className="data-buttons">
          <button type="button" onClick={exportData}>
            データを書き出す
          </button>
          <label className="button">
            データを読み込む
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                if (e.target.files[0]) importData(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
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
