import { useProject } from '../context/ProjectContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from './StatusBadge';

export default function Navbar() {
  const { projects, project, projectId, selectProject } = useProject();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <label htmlFor="project-select" className="text-xs font-medium text-slate-500">
          Project
        </label>
        <select
          id="project-select"
          value={projectId || ''}
          onChange={(e) => selectProject(e.target.value)}
          className="max-w-xs rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {!projects.length && <option value="">No projects</option>}
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        {project && <StatusBadge value={project.status} />}
      </div>
      {project && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <span>
            Budget: <strong className="text-slate-900">{formatCurrency(project.approvedBudget)}</strong>
          </span>
          <span>
            Duration: <strong className="text-slate-900">{project.durationWeeks} weeks</strong>
          </span>
          <span>
            Deadline: <strong className="text-slate-900">{formatDate(project.deadline)}</strong>
          </span>
        </div>
      )}
    </header>
  );
}
