import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/project', label: 'Project Management' },
  { to: '/scope', label: 'Scope Management' },
  { to: '/schedule', label: 'Schedule Management' },
  { to: '/cost', label: 'Cost Management' },
  { to: '/quality', label: 'Quality Management' },
  { to: '/risk', label: 'Risk Management' },
];

export default function Sidebar() {
  return (
    <aside className="w-full shrink-0 bg-slate-900 text-slate-200 md:min-h-screen md:w-60">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="text-sm font-semibold text-white">Smart Healthcare</div>
        <div className="text-xs text-slate-400">Project Management &amp; Monitoring</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col" aria-label="Main navigation">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-md px-3 py-2 text-sm ${isActive ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
