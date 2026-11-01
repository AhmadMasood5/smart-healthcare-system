export function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `PKR ${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: digits });
}

// Performance indices: null means "not computable" (zero denominator).
export function formatIndex(value) {
  if (value === null || value === undefined) return 'N/A';
  return Number(value).toFixed(4);
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Value for <input type="date">.
export function toInputDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export function daysBetween(a, b) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / DAY_MS);
}
