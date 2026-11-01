const COLORS = {
  // project / task / milestone
  Planned: 'bg-slate-100 text-slate-700',
  'Not Started': 'bg-slate-100 text-slate-700',
  'In Progress': 'bg-blue-100 text-blue-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Closed: 'bg-slate-200 text-slate-800',
  Pending: 'bg-amber-100 text-amber-800',
  Delayed: 'bg-red-100 text-red-800',
  // approvals
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  // severity / priority
  Critical: 'bg-red-600 text-white',
  High: 'bg-red-100 text-red-800',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-slate-100 text-slate-700',
  // defects
  Open: 'bg-red-100 text-red-800',
  Resolved: 'bg-emerald-100 text-emerald-800',
  // inspection
  Pass: 'bg-emerald-100 text-emerald-800',
  Fail: 'bg-red-100 text-red-800',
  'Not Inspected': 'bg-slate-100 text-slate-600',
  Draft: 'bg-slate-100 text-slate-700',
  Final: 'bg-emerald-100 text-emerald-800',
};

export default function StatusBadge({ value }) {
  if (!value) return null;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[value] || 'bg-slate-100 text-slate-700'}`}>
      {value}
    </span>
  );
}
