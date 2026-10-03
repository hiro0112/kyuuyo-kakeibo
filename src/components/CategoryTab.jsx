import { useState } from 'react';
import { OTHER_ID, addCategory, updateCategories } from '../lib/store.js';

// ⑤ カテゴリタブ：どの支払い名目をどのカテゴリに分類するかのルールを管理する
// ここを変更すると、支出タブの既存の明細も新しいルールで分類し直される
export default function CategoryTab({ state, setState }) {
  const [newName, setNewName] = useState('');

  const change = (fn) => setState((s) => updateCategories(s, fn(s.categories)));
  const patch = (id, fn) => change((cats) => cats.map((c) => (c.id === id ? fn(c) : c)));

  function addKeyword(id, raw) {
    const keyword = raw.trim();
    if (!keyword) return;
    // 同じ名目が複数のカテゴリに入らないよう、他のカテゴリからは外す
    change((cats) =>
      cats.map((c) => {
        const rest = c.keywords.filter((k) => k !== keyword);
        return c.id === id ? { ...c, keywords: [...rest, keyword] } : { ...c, keywords: rest };
      }),
    );
  }

  function remove(cat) {
    if (confirm(`カテゴリ「${cat.name}」を削除しますか？\nこのカテゴリの支出は、他のルールに一致しなければ「その他」に移ります。`)) {
      change((cats) => cats.filter((c) => c.id !== cat.id));
    }
  }

  function add(e) {
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
      <p className="hint">
        支払い名目に下記の語句が含まれる明細は、そのカテゴリに分類されます。PDFを読み取るたびに、Claudeが分類した名目がここに追加されます。
        語句を別のカテゴリに追加し直すと、支出タブの分類も変わります。
      </p>
      <div className="category-list">
        {state.categories.map((cat) => (
          <div key={cat.id} className="category-card">
            <div className="category-head">
              <input
                className="category-name"
                value={cat.name}
                onChange={(e) => patch(cat.id, (c) => ({ ...c, name: e.target.value }))}
              />
              {cat.id !== OTHER_ID && (
                <button type="button" className="danger" onClick={() => remove(cat)}>
                  カテゴリを削除
                </button>
              )}
            </div>
            <div className="chips">
              {cat.keywords.map((keyword) => (
                <span key={keyword} className="chip">
                  {keyword}
                  <button
                    type="button"
                    title="この名目を外す"
                    onClick={() => patch(cat.id, (c) => ({ ...c, keywords: c.keywords.filter((k) => k !== keyword) }))}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="chip-input"
                placeholder="名目を追加してEnter"
                onKeyDown={(e) => {
                  // 日本語変換の確定Enterでは追加しない
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    addKeyword(cat.id, e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <form className="inline-form" onSubmit={add}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="追加するカテゴリ名" />
        <button type="submit">＋ カテゴリを追加</button>
      </form>
    </>
  );
}
