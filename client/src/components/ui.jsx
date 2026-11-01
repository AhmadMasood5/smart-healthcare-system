// Small shared building blocks used by every page.
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-800">{title}</h2>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  default: 'text-slate-900',
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  bad: 'text-red-700',
};

export function StatCard({ label, value, hint, tone = 'default', testId }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid={testId}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${TONES[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
            active === t ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

const BUTTON_STYLES = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-300',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const sizing = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  return <button type="button" className={`rounded-md font-medium ${sizing} ${BUTTON_STYLES[variant]} ${className}`} {...props} />;
}

const inputClass = (error) =>
  `mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
    error ? 'border-red-400' : 'border-slate-300'
  }`;

export function Field({ label, name, error, as = 'input', options, children, className = '', ...props }) {
  const id = `f-${name}`;
  let control;
  if (as === 'select') {
    control = (
      <select id={id} name={name} className={inputClass(error)} {...props}>
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : children}
      </select>
    );
  } else if (as === 'textarea') {
    control = <textarea id={id} name={name} rows={3} className={inputClass(error)} {...props} />;
  } else {
    control = <input id={id} name={name} className={inputClass(error)} {...props} />;
  }
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      {control}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ErrorAlert({ error, onClose }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div role="alert" className="mb-4 flex items-start justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="ml-4 text-red-500 hover:text-red-700" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function SuccessAlert({ message, onClose }) {
  if (!message) return null;
  return (
    <div role="status" className="mb-4 flex items-start justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="ml-4 text-emerald-600" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function WarningList({ warnings }) {
  if (!warnings || !warnings.length) {
    return <p className="text-sm text-emerald-700">No warnings — all monitored thresholds are within limits.</p>;
  }
  return (
    <ul className="space-y-2" aria-label="Warnings">
      {warnings.map((w) => (
        <li
          key={w.type}
          className={`rounded-md border px-3 py-2 text-sm ${
            w.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <span className="mr-2 font-semibold">{w.severity === 'critical' ? 'Critical' : 'Warning'}:</span>
          {w.message}
        </li>
      ))}
    </ul>
  );
}

export function ProgressBar({ value, tone = 'teal' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const color = tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-teal-600';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-[60px] rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-slate-600">{pct.toFixed(0)}%</span>
    </div>
  );
}

export function Modal({ title, open, onClose, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-xl text-slate-400 hover:text-slate-600" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return <p className="py-8 text-center text-sm text-slate-500">{label}</p>;
}

export function NoProject() {
  return (
    <Card>
      <p className="text-sm text-slate-600">
        No project selected. Create a project under <strong>Project Management</strong> or run <code>npm run seed</code> to load the case study.
      </p>
    </Card>
  );
}
