// Client-side checks mirroring the backend rules; the backend remains the authority.
export const rules = {
  required: (label) => (v) => (v === undefined || v === null || String(v).trim() === '' ? `${label} is required` : null),
  number: (label, { min, max, integer, positive } = {}) => (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return `${label} must be a number`;
    if (integer && !Number.isInteger(n)) return `${label} must be a whole number`;
    if (positive && n <= 0) return `${label} must be greater than zero`;
    if (min !== undefined && n < min) return min === 0 ? `${label} cannot be negative` : `${label} must be at least ${min}`;
    if (max !== undefined && n > max) return `${label} must be at most ${max}`;
    return null;
  },
  date: (label) => (v) => (v && Number.isNaN(new Date(v).getTime()) ? `${label} must be a valid date` : null),
};

// schema: { field: [rule, rule, ...] } -> { field: firstErrorMessage }
export function validate(values, schema) {
  const errors = {};
  for (const [field, checks] of Object.entries(schema)) {
    for (const check of checks) {
      const msg = check(values[field], values);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  }
  return errors;
}

// Merge backend field errors ({field, message}[]) into a field map.
export function fieldErrorMap(err) {
  const map = {};
  for (const e of (err && err.fieldErrors) || []) if (e.field && !map[e.field]) map[e.field] = e.message;
  return map;
}
