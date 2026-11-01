// Calendar-day convention used across the system:
// - All dates are normalised to UTC midnight (time of day is ignored).
// - A task of duration D days starting on day S occupies days S .. S + D - 1 (inclusive).
// - A finish-to-start successor starts on the day after its latest predecessor ends.
// - A project of W weeks starting on S has its deadline on S + (W * 7) - 1.
const DAY_MS = 24 * 60 * 60 * 1000;

function toDay(value) {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(value, days) {
  return new Date(toDay(value).getTime() + days * DAY_MS);
}

// Whole days from b to a (a - b).
function diffDays(a, b) {
  return Math.round((toDay(a).getTime() - toDay(b).getTime()) / DAY_MS);
}

function endDateFor(start, durationDays) {
  return addDays(start, durationDays - 1);
}

function deadlineFrom(startDate, durationWeeks) {
  return addDays(startDate, durationWeeks * 7 - 1);
}

function maxDate(dates) {
  const valid = dates.filter(Boolean);
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((d) => toDay(d).getTime())));
}

function isValidDate(value) {
  if (value === null || value === undefined || value === '') return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

module.exports = { DAY_MS, toDay, addDays, diffDays, endDateFor, deadlineFrom, maxDate, isValidDate };
