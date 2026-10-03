import { useState } from 'react';
import { yen } from '../lib/fiscal.js';

// 金額を手動で入力・修正できるセル。フォーカスを外すかEnterで確定する
export default function NumberCell({ value, onChange }) {
  const [draft, setDraft] = useState(null);

  function commit() {
    if (draft === null) return;
    // 全角数字やカンマ・円記号が混ざっていても数値として解釈する
    const normalized = draft
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[,，¥￥円\s]/g, '')
      .replace(/[−ー－]/g, '-');
    const parsed = normalized === '' ? 0 : Math.round(Number(normalized));
    setDraft(null);
    if (Number.isFinite(parsed) && parsed !== value) onChange(parsed);
  }

  return (
    <input
      className="number-cell"
      inputMode="numeric"
      value={draft ?? (value ? yen(value) : '')}
      placeholder="0"
      onFocus={(e) => {
        setDraft(value ? String(value) : '');
        // 入力済みの金額をすぐ上書きできるよう全選択する
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
}
