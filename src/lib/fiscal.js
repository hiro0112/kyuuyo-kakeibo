// 年度（4月〜翌3月）と表の列に関する共通処理

// 表の列。月の並びの途中に夏・冬ボーナスの列を挟む
export const COLUMNS = [
  { key: '04', label: '4月' },
  { key: '05', label: '5月' },
  { key: '06', label: '6月' },
  { key: 'summerBonus', label: '夏ボーナス' },
  { key: '07', label: '7月' },
  { key: '08', label: '8月' },
  { key: '09', label: '9月' },
  { key: '10', label: '10月' },
  { key: '11', label: '11月' },
  { key: '12', label: '12月' },
  { key: 'winterBonus', label: '冬ボーナス' },
  { key: '01', label: '1月' },
  { key: '02', label: '2月' },
  { key: '03', label: '3月' },
];

export const columnLabel = (key) => COLUMNS.find((c) => c.key === key)?.label ?? key;

// 年・月から年度を求める（1〜3月は前年の年度）
export const fiscalYearOf = (year, month) => (month >= 4 ? year : year - 1);

export function currentFiscalYear() {
  const now = new Date();
  return fiscalYearOf(now.getFullYear(), now.getMonth() + 1);
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// "YYYY-MM-DD" から年度と列キーを求める。不正な日付は null
export function dateToFyCol(date) {
  const m = DATE_PATTERN.exec(date ?? '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { fy: fiscalYearOf(year, month), col: m[2] };
}

// 手動入力した金額を支出詳細タブに並べるときの代表日
export function representativeDate(fy, col) {
  if (col === 'summerBonus') return `${fy}-06-30`;
  if (col === 'winterBonus') return `${fy}-12-31`;
  const year = Number(col) >= 4 ? fy : fy + 1;
  return `${year}-${col}-01`;
}

export const yen = (n) => (n || 0).toLocaleString('ja-JP');
