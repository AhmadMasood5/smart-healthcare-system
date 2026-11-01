import { useState } from 'react';
import { api } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useLoader } from '../utils/useLoader';
import { useForm } from '../utils/useForm';
import { rules } from '../utils/validation';
import { formatCurrency, formatDate, toInputDate } from '../utils/formatters';
import { Button, Card, ErrorAlert, Field, Loading, Modal, PageHeader, SuccessAlert, Tabs } from '../components/ui';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import TeamPanel from '../components/TeamPanel';

const TABS = ['Project Charter', 'Management Plan', 'Milestones', 'Responsibilities', 'Project Closure'];
const STATUSES = ['Planned', 'In Progress', 'Completed', 'Closed'];

export default function ProjectManagement() {
  const { project, projectId } = useProject();
  const [tab, setTab] = useState(TABS[0]);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Project Management"
        subtitle="Project initiation and integration: charter, management plan, milestones, responsibilities and closure."
        actions={!creating && <Button onClick={() => { setCreating(true); setTab(TABS[0]); }}>New Project</Button>}
      />
      {creating || !project ? (
        <CharterForm key="new" onDone={() => setCreating(false)} onCancel={project ? () => setCreating(false) : null} />
      ) : (
        <>
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          {tab === 'Project Charter' && (
            <div className="space-y-6">
              <CharterForm key={project._id + project.updatedAt} project={project} />
              <Stakeholders projectId={projectId} />
            </div>
          )}
          {tab === 'Management Plan' && <PlanPanel project={project} />}
          {tab === 'Milestones' && <MilestonesPanel projectId={projectId} />}
          {tab === 'Responsibilities' && <TeamPanel projectId={projectId} />}
          {tab === 'Project Closure' && <ClosurePanel project={project} />}
        </>
      )}
    </div>
  );
}

const CHARTER_SCHEMA = {
  name: [rules.required('Project name')],
  description: [rules.required('Description')],
  objectives: [rules.required('Objectives')],
  scopeBoundaries: [rules.required('Scope boundaries')],
  approvedBudget: [rules.required('Approved budget'), rules.number('Approved budget', { positive: true })],
  startDate: [rules.required('Start date'), rules.date('Start date')],
  durationWeeks: [rules.required('Duration'), rules.number('Duration', { integer: true, positive: true })],
  projectManager: [rules.required('Project manager')],
};

function charterValues(p) {
  return {
    name: p ? p.name : '',
    description: p ? p.description : '',
    objectives: p ? p.objectives.join('\n') : '',
    scopeBoundaries: p ? p.scopeBoundaries : '',
    approvedBudget: p ? String(p.approvedBudget) : '',
    startDate: p ? toInputDate(p.startDate) : '',
    durationWeeks: p ? String(p.durationWeeks) : '',
    projectManager: p ? p.projectManager : '',
    status: p ? p.status : 'Planned',
  };
}

export function CharterForm({ project, onDone, onCancel }) {
  const { refreshProjects, selectProject } = useProject();
  const form = useForm(charterValues(project), CHARTER_SCHEMA);
  const [saved, setSaved] = useState('');
  const v = form.values;

  // Deadline preview uses the same rule as the backend: start + weeks*7 - 1 days.
  const deadlinePreview =
    v.startDate && Number(v.durationWeeks) > 0 && !Number.isNaN(new Date(v.startDate).getTime())
      ? formatDate(new Date(new Date(v.startDate).getTime() + (Number(v.durationWeeks) * 7 - 1) * 86400000))
      : '—';

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      ...v,
      objectives: v.objectives.split('\n').map((o) => o.trim()).filter(Boolean),
      approvedBudget: Number(v.approvedBudget),
      durationWeeks: Number(v.durationWeeks),
    };
    let result;
    const ok = await form.submit(async () => {
      result = project ? await api.projects.update(project._id, payload) : await api.projects.create(payload);
    });
    if (ok) {
      setSaved(project ? 'Project charter updated.' : 'Project created.');
      await refreshProjects();
      if (!project) selectProject(result._id);
      if (onDone) onDone();
    }
  }

  return (
    <Card title={project ? 'Project Charter' : 'Create Project Charter'}>
      <SuccessAlert message={saved} onClose={() => setSaved('')} />
      <ErrorAlert error={form.apiError} />
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2" noValidate>
        <Field label="Project name" name="name" value={v.name} onChange={form.onChange} error={form.errors.name} className="md:col-span-2" />
        <Field label="Description" name="description" as="textarea" value={v.description} onChange={form.onChange} error={form.errors.description} className="md:col-span-2" />
        <Field label="Objectives (one per line)" name="objectives" as="textarea" value={v.objectives} onChange={form.onChange} error={form.errors.objectives} />
        <Field label="Scope boundaries" name="scopeBoundaries" as="textarea" value={v.scopeBoundaries} onChange={form.onChange} error={form.errors.scopeBoundaries} />
        <Field label="Approved budget (PKR)" name="approvedBudget" type="number" min="1" value={v.approvedBudget} onChange={form.onChange} error={form.errors.approvedBudget} />
        <Field label="Project manager" name="projectManager" value={v.projectManager} onChange={form.onChange} error={form.errors.projectManager} />
        <Field label="Start date" name="startDate" type="date" value={v.startDate} onChange={form.onChange} error={form.errors.startDate} />
        <Field label="Duration (weeks)" name="durationWeeks" type="number" min="1" step="1" value={v.durationWeeks} onChange={form.onChange} error={form.errors.durationWeeks} />
        <div>
          <span className="block text-xs font-medium text-slate-600">Deadline (calculated)</span>
          <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" data-testid="deadline-preview">
            {deadlinePreview}
          </div>
        </div>
        <Field label="Project status" name="status" as="select" value={v.status} onChange={form.onChange} options={STATUSES.map((s) => ({ value: s, label: s }))} />
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={form.submitting}>
            {project ? 'Save Charter' : 'Create Project'}
          </Button>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function Stakeholders({ projectId }) {
  const list = useLoader(() => api.stakeholders.list(projectId), [projectId]);
  const form = useForm({ name: '', role: '', interest: '', influence: 'Medium' }, { name: [rules.required('Name')], role: [rules.required('Role')] });
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState(null);

  async function add(e) {
    e.preventDefault();
    if (await form.submit((v) => api.stakeholders.create({ ...v, project: projectId }))) {
      form.reset();
      list.reload();
    }
  }

  async function confirmDelete() {
    try {
      await api.stakeholders.remove(toDelete._id);
      list.reload();
    } catch (err) {
      setError(err);
    }
    setToDelete(null);
  }

  return (
    <Card title="Stakeholders">
      <ErrorAlert error={error || list.error || form.apiError} />
      <DataTable
        label="Stakeholders"
        rows={list.data || []}
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'role', header: 'Role' },
          { key: 'interest', header: 'Interest' },
          { key: 'influence', header: 'Influence', render: (s) => <StatusBadge value={s.influence} /> },
          { key: 'x', header: '', render: (s) => <Button size="sm" variant="secondary" onClick={() => setToDelete(s)}>Remove</Button> },
        ]}
      />
      <form onSubmit={add} className="mt-4 grid gap-3 md:grid-cols-5 md:items-end">
        <Field label="Name" name="name" value={form.values.name} onChange={form.onChange} error={form.errors.name} />
        <Field label="Role" name="role" value={form.values.role} onChange={form.onChange} error={form.errors.role} />
        <Field label="Interest" name="interest" value={form.values.interest} onChange={form.onChange} />
        <Field label="Influence" name="influence" as="select" value={form.values.influence} onChange={form.onChange} options={['Low', 'Medium', 'High'].map((x) => ({ value: x, label: x }))} />
        <Button type="submit" disabled={form.submitting}>
          Add Stakeholder
        </Button>
      </form>
      <ConfirmDialog open={!!toDelete} title="Remove stakeholder" confirmLabel="Remove" variant="danger" onConfirm={confirmDelete} onCancel={() => setToDelete(null)}>
        Remove <strong>{toDelete && toDelete.name}</strong> from the stakeholder register?
      </ConfirmDialog>
    </Card>
  );
}

const PLAN_FIELDS = [
  ['scopePlan', 'Scope management plan'],
  ['schedulePlan', 'Schedule management plan'],
  ['costPlan', 'Cost management plan'],
  ['qualityPlan', 'Quality management plan'],
];

function PlanPanel({ project }) {
  const plan = useLoader(() => api.plans.get(project._id), [project._id]);
  if (plan.loading && !plan.data) return <Loading />;
  return <PlanForm key={plan.data ? plan.data.updatedAt : 'new'} project={project} plan={plan.data} onSaved={plan.reload} loadError={plan.error} />;
}

function PlanForm({ project, plan, onSaved, loadError }) {
  const schema = Object.fromEntries(PLAN_FIELDS.map(([k, l]) => [k, [rules.required(l)]]));
  const form = useForm(Object.fromEntries(PLAN_FIELDS.map(([k]) => [k, plan ? plan[k] : ''])), schema);
  const [saved, setSaved] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    const ok = await form.submit((v) => (plan ? api.plans.update(plan._id, v) : api.plans.create({ ...v, project: project._id })));
    if (ok) {
      setSaved('Project management plan saved.');
      onSaved();
    }
  }

  return (
    <div className="space-y-6">
      <Card title={plan ? `Project Management Plan (version ${plan.version})` : 'Create Project Management Plan'}>
        <SuccessAlert message={saved} onClose={() => setSaved('')} />
        <ErrorAlert error={loadError || form.apiError} />
        {plan && (
          <div className="mb-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm md:grid-cols-3" data-testid="plan-baseline">
            <div>Baseline budget: <strong>{formatCurrency(plan.baselineBudget)}</strong></div>
            <div>Baseline duration: <strong>{plan.baselineDurationWeeks} weeks</strong></div>
            <div>Baseline deadline: <strong>{formatDate(plan.baselineDeadline)}</strong></div>
          </div>
        )}
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2" noValidate>
          {PLAN_FIELDS.map(([k, label]) => (
            <Field key={k} label={label} name={k} as="textarea" rows={4} value={form.values[k]} onChange={form.onChange} error={form.errors[k]} />
          ))}
          <div className="md:col-span-2">
            <Button type="submit" disabled={form.submitting}>
              {plan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </div>
        </form>
      </Card>
      {plan && (
        <Card title="Revision History">
          <DataTable
            rowKey="version"
            rows={[...plan.revisions].reverse()}
            columns={[
              { key: 'version', header: 'Version' },
              { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
              { key: 'description', header: 'Change' },
            ]}
          />
        </Card>
      )}
    </div>
  );
}

const MILESTONE_EMPTY = { title: '', description: '', plannedDate: '', linkedTask: '', completionStatus: 'Pending', actualCompletionDate: '' };

function MilestonesPanel({ projectId }) {
  const list = useLoader(() => api.milestones.list(projectId), [projectId]);
  const tasks = useLoader(() => api.tasks.list(projectId), [projectId]);
  const [editing, setEditing] = useState(null);
  const form = useForm(MILESTONE_EMPTY, {
    title: [rules.required('Title')],
    plannedDate: [(val, all) => (!val && !all.linkedTask ? 'Planned date is required (or link a task)' : null), rules.date('Planned date')],
    actualCompletionDate: [(val, all) => (all.completionStatus === 'Completed' && !val ? 'Actual completion date is required' : null)],
  });

  const open = (m) => {
    setEditing(m || 'new');
    form.reset(
      m
        ? {
            title: m.title,
            description: m.description,
            plannedDate: toInputDate(m.plannedDate),
            linkedTask: m.linkedTask ? m.linkedTask._id : '',
            completionStatus: m.completionStatus,
            actualCompletionDate: toInputDate(m.actualCompletionDate),
          }
        : MILESTONE_EMPTY
    );
  };

  async function save(e) {
    e.preventDefault();
    const ok = await form.submit((v) => {
      const body = { ...v, actualCompletionDate: v.completionStatus === 'Completed' ? v.actualCompletionDate : null };
      if (!body.plannedDate) delete body.plannedDate;
      return editing === 'new' ? api.milestones.create({ ...body, project: projectId }) : api.milestones.update(editing._id, body);
    });
    if (ok) {
      setEditing(null);
      list.reload();
    }
  }

  return (
    <Card title="Milestones" actions={<Button onClick={() => open(null)}>Add Milestone</Button>}>
      <ErrorAlert error={list.error} />
      <DataTable
        label="Milestones"
        rows={list.data || []}
        columns={[
          { key: 'title', header: 'Title' },
          { key: 'description', header: 'Description' },
          { key: 'plannedDate', header: 'Planned date', render: (m) => formatDate(m.plannedDate) },
          { key: 'linkedTask', header: 'Linked task', render: (m) => (m.linkedTask ? `${m.linkedTask.taskId} ${m.linkedTask.title}` : '—') },
          { key: 'actual', header: 'Actual completion', render: (m) => formatDate(m.actualCompletionDate) },
          { key: 'completionStatus', header: 'Status', render: (m) => <StatusBadge value={m.completionStatus} /> },
          { key: 'x', header: '', render: (m) => <Button size="sm" variant="secondary" onClick={() => open(m)}>Edit</Button> },
        ]}
      />
      <Modal open={!!editing} title={editing === 'new' ? 'Add Milestone' : 'Update Milestone'} onClose={() => setEditing(null)}>
        <ErrorAlert error={form.apiError} />
        <form onSubmit={save} className="space-y-3" noValidate>
          <Field label="Title" name="title" value={form.values.title} onChange={form.onChange} error={form.errors.title} />
          <Field label="Description" name="description" as="textarea" value={form.values.description} onChange={form.onChange} />
          <Field label="Linked task (planned date follows the task's scheduled finish)" name="linkedTask" as="select" value={form.values.linkedTask} onChange={form.onChange}>
            <option value="">None</option>
            {(tasks.data || []).map((t) => (
              <option key={t._id} value={t._id}>
                {t.taskId} {t.title}
              </option>
            ))}
          </Field>
          {!form.values.linkedTask && (
            <Field label="Planned date" name="plannedDate" type="date" value={form.values.plannedDate} onChange={form.onChange} error={form.errors.plannedDate} />
          )}
          <Field label="Completion status" name="completionStatus" as="select" value={form.values.completionStatus} onChange={form.onChange} options={['Pending', 'Completed'].map((s) => ({ value: s, label: s }))} />
          {form.values.completionStatus === 'Completed' && (
            <Field label="Actual completion date" name="actualCompletionDate" type="date" value={form.values.actualCompletionDate} onChange={form.onChange} error={form.errors.actualCompletionDate} />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.submitting}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function ClosurePanel({ project }) {
  const closure = useLoader(() => api.closures.get(project._id), [project._id]);
  if (closure.loading && !closure.data) return <Loading />;
  return <ClosureForm key={closure.data ? closure.data.updatedAt : 'new'} project={project} closure={closure.data} onSaved={closure.reload} />;
}

function ClosureForm({ project, closure, onSaved }) {
  const { refreshProjects } = useProject();
  const form = useForm(
    {
      closureDate: closure ? toInputDate(closure.closureDate) : '',
      closureStatus: closure ? closure.closureStatus : 'Draft',
      closureNotes: closure ? closure.closureNotes : '',
      finalSummary: closure ? closure.finalSummary : '',
    },
    {
      closureDate: [rules.required('Closure date'), rules.date('Closure date')],
      closureNotes: [rules.required('Closure notes')],
      finalSummary: [rules.required('Final project summary')],
    }
  );
  const [saved, setSaved] = useState('');
  const [reportError, setReportError] = useState(null);

  // Pre-fills the summary from the live integrated report.
  async function insertReportSummary() {
    try {
      const r = await api.report(project._id);
      form.setValues((v) => ({
        ...v,
        finalSummary:
          `Overall progress ${r.overallProgress}%. Budget ${formatCurrency(r.budgetStatus.approvedBudget)}, spent ${formatCurrency(r.budgetStatus.actualExpenditure)}. ` +
          `CPI ${r.evm.cpi ?? 'N/A'}, SPI ${r.evm.spi ?? 'N/A'}. Tasks completed ${r.schedule.completedTasks}/${r.schedule.totalTasks}. ` +
          `Unresolved critical defects: ${r.unresolvedCriticalDefects.length}. Pending change requests: ${r.pendingChangeRequests.length}.`,
      }));
    } catch (err) {
      setReportError(err);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const ok = await form.submit((v) => (closure ? api.closures.update(closure._id, v) : api.closures.create({ ...v, project: project._id })));
    if (ok) {
      setSaved(form.values.closureStatus === 'Final' ? 'Closure finalised — project status set to Closed.' : 'Closure record saved.');
      await refreshProjects();
      onSaved();
    }
  }

  return (
    <Card title="Project Closure">
      <SuccessAlert message={saved} onClose={() => setSaved('')} />
      <ErrorAlert error={form.apiError || reportError} />
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2" noValidate>
        <Field label="Closure date" name="closureDate" type="date" value={form.values.closureDate} onChange={form.onChange} error={form.errors.closureDate} />
        <Field
          label="Closure status (Final closes the project)"
          name="closureStatus"
          as="select"
          value={form.values.closureStatus}
          onChange={form.onChange}
          options={['Draft', 'Final'].map((s) => ({ value: s, label: s }))}
        />
        <Field label="Closure notes" name="closureNotes" as="textarea" value={form.values.closureNotes} onChange={form.onChange} error={form.errors.closureNotes} className="md:col-span-2" />
        <Field label="Final project summary" name="finalSummary" as="textarea" rows={4} value={form.values.finalSummary} onChange={form.onChange} error={form.errors.finalSummary} className="md:col-span-2" />
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" disabled={form.submitting}>
            {closure ? 'Update Closure Record' : 'Save Closure Record'}
          </Button>
          <Button variant="secondary" onClick={insertReportSummary}>
            Insert current report summary
          </Button>
        </div>
      </form>
    </Card>
  );
}
