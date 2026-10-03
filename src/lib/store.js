// アプリのデータ（ローカルストレージに保存）と、その更新処理
import { dateToFyCol, fiscalYearOf, representativeDate } from './fiscal.js';

const STORAGE_KEY = 'kyuyo-kakeibo-v1';

// 「その他」は分類先がない明細の受け皿なので削除できない
export const OTHER_ID = 'other';

const DEFAULT_CATEGORY_NAMES = ['保険料', '交通費', 'サブスク', '食事代', '日常', 'EC', '娯楽'];

export const newId = () => crypto.randomUUID();

function initialState() {
  return {
    // incomes[年度][列キー] = { gross: 収入, deduction: 控除合計 }
    incomes: {},
    // 貼り付けた給与明細ファイルと、そこから読み取った内容
    // [{ id, fileName, cells: [{ fy, col, gross, deduction }] }]
    incomeImports: [],
    // 支出明細。支出タブの表はこの配列をカテゴリ・月ごとに集計したもの
    transactions: [],
    categories: [
      ...DEFAULT_CATEGORY_NAMES.map((name) => ({ id: newId(), name, keywords: [] })),
      { id: OTHER_ID, name: 'その他', keywords: [] },
    ],
  };
}

export function loadState() {
  // 以前の版がブラウザ内に保存していたPDF本体は不要になったので消す
  try {
    indexedDB.deleteDatabase('kyuyo-kakeibo-files');
  } catch {
    // 消せなくても動作に影響はない
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.categories) && Array.isArray(saved.transactions)) {
      return { ...initialState(), ...saved };
    }
  } catch {
    // 壊れたデータは無視して初期状態から始める
  }
  return initialState();
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---- 収入 ----

export function setIncomeCell(state, fy, col, field, value) {
  const year = state.incomes[fy] ?? {};
  const cell = { gross: 0, deduction: 0, ...year[col], [field]: value };
  return { ...state, incomes: { ...state.incomes, [fy]: { ...year, [col]: cell } } };
}

// Claudeが読み取った給与明細を、年度と列に変換する。不正なものは除く
export function payslipsToCells(payslips) {
  return payslips
    .filter((p) => p.month >= 1 && p.month <= 12)
    .map((p) => ({
      fy: fiscalYearOf(p.year, p.month),
      col: p.type === 'monthly' ? String(p.month).padStart(2, '0') : p.type,
      gross: p.gross,
      deduction: p.deduction,
    }));
}

// 読み取った給与明細を表に反映し、貼り付けたファイルとして記録する
export function addIncomeImport(state, importId, fileName, cells) {
  const incomes = { ...state.incomes };
  for (const { fy, col, gross, deduction } of cells) {
    incomes[fy] = { ...incomes[fy], [col]: { gross, deduction } };
  }
  const incomeImports = [...state.incomeImports, { id: importId, fileName, cells }];
  return { ...state, incomes, incomeImports };
}

// 貼り付けた給与明細ファイルを削除し、そのファイルから読み取った金額も表から消す
export function removeIncomeImport(state, importId) {
  const target = state.incomeImports.find((i) => i.id === importId);
  if (!target) return state;
  const incomeImports = state.incomeImports.filter((i) => i.id !== importId);
  const incomes = { ...state.incomes };
  for (const { fy, col } of target.cells) {
    // 同じ月の明細が他のファイルにもあれば、そちらの金額に戻す
    const other = incomeImports
      .flatMap((i) => i.cells)
      .findLast((c) => c.fy === fy && c.col === col);
    const year = { ...incomes[fy] };
    if (other) year[col] = { gross: other.gross, deduction: other.deduction };
    else delete year[col];
    incomes[fy] = year;
  }
  return { ...state, incomes, incomeImports };
}

// ---- カテゴリ分類 ----

// カテゴリタブのルール（キーワード）で分類する。最も長く一致したキーワードを優先
export function classify(categories, description) {
  const text = description.toLowerCase();
  let best = null;
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (text.includes(keyword.toLowerCase()) && (!best || keyword.length > best.length)) {
        best = { id: category.id, length: keyword.length };
      }
    }
  }
  return best?.id ?? null;
}

// カテゴリを変更し、既存の支出明細を新しいルールで分類し直す
export function updateCategories(state, categories) {
  const ids = new Set(categories.map((c) => c.id));
  const transactions = state.transactions.map((tx) => {
    const current = ids.has(tx.categoryId) ? tx.categoryId : OTHER_ID;
    const categoryId = tx.manual ? current : (classify(categories, tx.description) ?? current);
    return categoryId === tx.categoryId ? tx : { ...tx, categoryId };
  });
  return { ...state, categories, transactions };
}

export function addCategory(state, name) {
  const category = { id: newId(), name, keywords: [] };
  // 「その他」は常に最後の行にする
  const others = state.categories.filter((c) => c.id !== OTHER_ID);
  const other = state.categories.filter((c) => c.id === OTHER_ID);
  return { ...state, categories: [...others, category, ...other] };
}

// ---- 支出 ----

// Claudeが読み取った支払明細を取り込む。戻り値は [新しいstate, 取り込んだ件数]
export function addImportedTransactions(state, importId, fileName, items) {
  const categories = state.categories.map((c) => ({ ...c, keywords: [...c.keywords] }));
  const added = [];

  for (const item of items) {
    const position = dateToFyCol(item.date);
    const description = (item.description ?? '').trim();
    if (!position || !description || !Number.isFinite(item.amount)) continue;

    // カテゴリタブのルールに一致すればそれを優先し、なければClaudeの分類を使う
    let categoryId = classify(categories, description);
    if (!categoryId) {
      const category = categories.find((c) => c.name === item.category) ?? categories.find((c) => c.id === OTHER_ID);
      categoryId = category.id;
      // Claudeの分類結果をルールとしてカテゴリタブに残す
      const keyword = (item.keyword ?? '').trim();
      const usable = keyword.length >= 2 && description.toLowerCase().includes(keyword.toLowerCase());
      category.keywords.push(usable ? keyword : description);
    }

    added.push({
      id: newId(),
      date: item.date,
      description,
      amount: item.amount,
      categoryId,
      ...position,
      importId,
      sourceFile: fileName,
    });
  }

  return [{ ...state, categories, transactions: [...state.transactions, ...added] }, added.length];
}

export function removeImport(state, importId) {
  return { ...state, transactions: state.transactions.filter((tx) => tx.importId !== importId) };
}

// 支出タブのセルを手動で書き換える。
// PDFから読み取った明細はそのまま残し、差額を「手動入力」の明細として持つ
export function setExpenseCell(state, fy, col, categoryId, value) {
  const inCell = (tx) => tx.fy === fy && tx.col === col && tx.categoryId === categoryId;
  const imported = state.transactions
    .filter((tx) => inCell(tx) && !tx.manual)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const transactions = state.transactions.filter((tx) => !(inCell(tx) && tx.manual));
  const diff = value - imported;
  if (diff !== 0) {
    transactions.push({
      id: newId(),
      date: representativeDate(fy, col),
      description: '手動入力',
      amount: diff,
      categoryId,
      fy,
      col,
      manual: true,
    });
  }
  return { ...state, transactions };
}

// 指定年度の支出を totals[カテゴリID][列キー] の形に集計する
export function expenseTotals(transactions, fy) {
  const totals = {};
  for (const tx of transactions) {
    if (tx.fy !== fy) continue;
    const row = (totals[tx.categoryId] ??= {});
    row[tx.col] = (row[tx.col] ?? 0) + tx.amount;
  }
  return totals;
}
