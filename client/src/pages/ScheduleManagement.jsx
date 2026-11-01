import { useState } from 'react';
import { api } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useLoader } from '../utils/useLoader';
import { useForm } from '../utils/useForm';
import { rules } from '../utils/validation';
import { formatDate, toInputDate } from '../utils/formatters';
import { Button, Card, ErrorAlert, Field, Loading, Modal, NoProject, PageHeader, ProgressBar, StatCard, SuccessAlert, Tabs } from '../components/ui';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import GanttChart from '../components/GanttChart';
import TeamPanel from '../components/TeamPanel';

const TABS = ['Tasks', 'Dependencies', 'Gantt Chart', 'Delay Analysis', 'Team'];

export default function ScheduleManagement() {
  const { projectId } = useProject();
  const [tab, setTab] = useState(TABS[0]);
  const schedule = useLoader(() => (projectId ? api.schedule(projectId) : Promise.resolve(null)), [projectId]);
  const tasks = useLoader(() => (projectId ? api.tasks.list(projectId) : Promise.resolve([])), [projectId]);

  if (!projectId) return <NoProject />;
  const refresh = () => {
    schedule.reload();
    tasks.reload();
  };
  const s = schedule.data && schedule.data.summary;

  return (
    <div>
      <PageHeader title="Schedule Management" subtitle="Tasks, finish-to-start dependencies, automatic scheduling, delay detection and resources." />
      <ErrorAlert error={schedule.error || tasks.error} />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8" aria-label="Schedule summary">
          <StatCard label="Total tasks" value={s.totalTasks} testId="sched-total" />
          <StatCard label="Completed" value={s.completedTasks} tone="good" />
          <StatCard label="In progress" value={s.inProgressTasks} />
          <StatCard label="Delayed" value={s.delayedTasks} tone={s.delayedTasks ? 'bad' : 'good'} testId="sched-delayed" />
          <StatCard label="Assigned members" value={s.assignedMembers} />
          <StatCard label="Planned completion" value={formatDate(s.plannedCompletion)} />
          <StatCard
            label="Forecast completion"
            value={formatDate(s.forecastCompletion)}
            tone={s.forecastVsDeadlineDays > 0 ? 'bad' : 'good'}
            hint={s.forecastVsDeadlineDays > 0 ? `${s.forecastVsDeadlineDays} days after deadline` : `${-s.forecastVsDeadlineDays} days before deadline`}
          />
          <StatCard label="Approved deadline" value={formatDate(s.approvedDeadline)} />
        </div>
      )}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Tasks' && <TasksPanel projectId={projectId} tasks={tasks} schedule={schedule.data} onChange={refresh} />}
      {tab === 'Dependencies' && <DependenciesPanel projectId={projectId} tasks={tasks.data || []} onChange={refresh} />}
      {tab === 'Gantt Chart' && (
        <Card title="Gantt Chart">{schedule.data ? <GanttChart schedule={schedule.data} /> : <Loading />}</Card>
      )}
      {tab === 'Delay Analysis' && <DelayPanel schedule={schedule.data} />}
      {tab === 'Team' && <TeamPanel projectId={projectId} onChange={refresh} />}
    </div>
  );
}

const TASK_EMPTY = { title: '', description: '', assignedTo: '', wbsItem: '', estimatedDuration: '' };
const TASK_SCHEMA = {
  title: [rules.required('Task title')],
  estimatedDuration: [rules.required('Estimated duration'), rules.number('Estimated duration', { integer: true, positive: true })],
};
const PROGRESS_SCHEMA = {
  ...TASK_SCHEMA,
  progress: [rules.required('Progress'), rules.number('Progress', { min: 0, max: 100 })],
  actualStartDate: [rules.date('Actual start date'), (v, all) => (all.status !== 'Not Started' && !v ? 'Actual start date is required once work has started' : null)],
  actualEndDate: [
    rules.date('Actual end date'),
    (v, all) => (all.status === 'Completed' && !v ? 'Actual end date is required for a completed task' : null),
    (v, all) => (v && all.actualStartDate && v < all.actualStartDate ? 'Actual end date cannot be before the start date' : null),
  ],
};

function TasksPanel({ projectId, tasks, schedule, onChange }) {
  const team = useLoader(() => api.teamMembers.list(projectId), [projectId]);
  const wbs = useLoader(() => api.wbs.list(projectId), [projectId]);
  const add = useForm(TASK_EMPTY, TASK_SCHEMA);
  const edit = useForm({}, PROGRESS_SCHEMA);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const delayById = Object.fromEntries(((schedule && schedule.tasks) || []).map((t) => [t.id, t]));

  const memberOptions = (
    <>
      <option value="">Unassigned</option>
      {(team.data || []).map((m) => (
        <option key={m._id} value={m._id}>
          {m.name} — {m.role}
        </option>
      ))}
    </>
  );
  const wbsOptions = (
    <>
      <option value="">None</option>
      {(wbs.data || []).map((w) => (
        <option key={w._id} value={w._id}>
          {w.title} ({w.type})
        </option>
      ))}
    </>
  );

  async function onAdd(e) {
    e.preventDefault();
    const ok = await add.submit((v) => api.tasks.create({ ...v, project: projectId, estimatedDuration: Number(v.estimatedDuration), assignedTo: v.assignedTo || null, wbsItem: v.wbsItem || null }));
    if (ok) {
      add.reset();
      setMessage('Task created and scheduled.');
      onChange();
    }
  }

  function openEdit(t) {
    setEditing(t);
    edit.reset({
      title: t.title,
      description: t.description || '',
      assignedTo: t.assignedTo ? t.assignedTo._id : '',
      wbsItem: t.wbsItem ? t.wbsItem._id : '',
      estimatedDuration: String(t.estimatedDuration),
      status: t.status,
      progress: String(t.progress),
      actualStartDate: toInputDate(t.actualStartDate),
      actualEndDate: toInputDate(t.actualEndDate),
    });
  }

  async function onEdit(e) {
    e.preventDefault();
    const ok = await edit.submit((v) =>
      api.tasks.update(editing._id, {
        ...v,
        estimatedDuration: Number(v.estimatedDuration),
        progress: Number(v.progress),
        assignedTo: v.assignedTo || null,
        wbsItem: v.wbsItem || null,
        actualStartDate: v.actualStartDate || null,
        actualEndDate: v.actualEndDate || null,
      })
    );
    if (ok) {
      setEditing(null);
      setMessage(`${editing.taskId} updated; schedule recalculated.`);
      onChange();
    }
  }

  return (
    <div className="space-y-6">
      <SuccessAlert message={message} onClose={() => setMessage('')} />
      <Card title="Tasks">
        <DataTable
          label="Tasks"
          rows={tasks.data || []}
          rowClassName={(t) => (delayById[t._id] && delayById[t._id].isDelayed ? 'bg-red-50/60' : '')}
          columns={[
            { key: 'taskId', header: 'ID' },
            { key: 'title', header: 'Task', render: (t) => <span className="font-medium">{t.title}</span> },
            { key: 'assignedTo', header: 'Assigned', render: (t) => (t.assignedTo ? t.assignedTo.name : '—') },
            { key: 'estimatedDuration', header: 'Duration', render: (t) => `${t.estimatedDuration} d` },
            { key: 'planned', header: 'Planned start → end', render: (t) => `${formatDate(t.plannedStartDate)} → ${formatDate(t.plannedEndDate)}` },
            { key: 'actual', header: 'Actual start → end', render: (t) => `${formatDate(t.actualStartDate)} → ${formatDate(t.actualEndDate)}` },
            { key: 'predecessors', header: 'Depends on', render: (t) => t.predecessors.map((p) => p.taskId).join(', ') || '—' },
            { key: 'progress', header: 'Progress', render: (t) => <ProgressBar value={t.progress} /> },
            {
              key: 'status',
              header: 'Status',
              render: (t) => (
                <div className="flex flex-col gap-1">
                  <StatusBadge value={t.status} />
                  {delayById[t._id] && delayById[t._id].isDelayed && <StatusBadge value="Delayed" />}
                </div>
              ),
            },
            { key: 'x', header: '', render: (t) => <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>Update</Button> },
          ]}
        />
      </Card>

      <Card title="Create Task">
        <ErrorAlert error={add.apiError} />
        <form onSubmit={onAdd} className="grid gap-3 md:grid-cols-3" noValidate>
          <Field label="Task title" name="title" value={add.values.title} onChange={add.onChange} error={add.errors.title} />
          <Field label="Estimated duration (days)" name="estimatedDuration" type="number" min="1" step="1" value={add.values.estimatedDuration} onChange={add.onChange} error={add.errors.estimatedDuration} />
          <Field label="Assigned developer" name="assignedTo" as="select" value={add.values.assignedTo} onChange={add.onChange}>
            {memberOptions}
          </Field>
          <Field label="WBS item" name="wbsItem" as="select" value={add.values.wbsItem} onChange={add.onChange}>
            {wbsOptions}
          </Field>
          <Field label="Description" name="description" value={add.values.description} onChange={add.onChange} className="md:col-span-2" />
          <div className="md:col-span-3">
            <Button type="submit" disabled={add.submitting}>
              Create Task
            </Button>
            <span className="ml-3 text-xs text-slate-500">Planned dates are calculated automatically from dependencies.</span>
          </div>
        </form>
      </Card>

      <Modal open={!!editing} title={editing ? `Update ${editing.taskId} — ${editing.title}` : ''} onClose={() => setEditing(null)} wide>
        <ErrorAlert error={edit.apiError} />
        {editing && (
          <form onSubmit={onEdit} className="grid gap-3 md:grid-cols-2" noValidate>
            <Field label="Task title" name="title" value={edit.values.title} onChange={edit.onChange} error={edit.errors.title} />
            <Field label="Estimated duration (days)" name="estimatedDuration" type="number" min="1" value={edit.values.estimatedDuration} onChange={edit.onChange} error={edit.errors.estimatedDuration} />
            <Field label="Assigned developer" name="assignedTo" as="select" value={edit.values.assignedTo} onChange={edit.onChange} error={edit.errors.assignedTo}>
              {memberOptions}
            </Field>
            <Field label="WBS item" name="wbsItem" as="select" value={edit.values.wbsItem} onChange={edit.onChange}>
              {wbsOptions}
            </Field>
            <Field label="Status" name="status" as="select" value={edit.values.status} onChange={edit.onChange} error={edit.errors.status} options={['Not Started', 'In Progress', 'Completed'].map((x) => ({ value: x, label: x }))} />
            <Field label="Progress (%)" name="progress" type="number" min="0" max="100" value={edit.values.progress} onChange={edit.onChange} error={edit.errors.progress} />
            <Field label="Actual start date" name="actualStartDate" type="date" value={edit.values.actualStartDate} onChange={edit.onChange} error={edit.errors.actualStartDate} />
            <Field label="Actual end date" name="actualEndDate" type="date" value={edit.values.actualEndDate} onChange={edit.onChange} error={edit.errors.actualEndDate} />
            <Field label="Description" name="description" as="textarea" value={edit.values.description} onChange={edit.onChange} className="md:col-span-2" />
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={edit.submitting}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function DependenciesPanel({ projectId, tasks, onChange }) {
  const deps = useLoader(() => api.dependencies.list(projectId), [projectId]);
  const form = useForm(
    { predecessor: '', successor: '' },
    {
      predecessor: [rules.required('Predecessor')],
      successor: [rules.required('Successor'), (v, all) => (v && v === all.predecessor ? 'A task cannot depend on itself' : null)],
    }
  );
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState(null);

  async function onAdd(e) {
    e.preventDefault();
    if (await form.submit((v) => api.dependencies.create(v))) {
      form.reset();
      deps.reload();
      onChange();
    }
  }

  async function remove() {
    try {
      await api.dependencies.remove(toDelete._id);
      deps.reload();
      onChange();
    } catch (err) {
      setError(err);
    }
    setToDelete(null);
  }

  const taskOptions = (
    <>
      <option value="">Select task…</option>
      {tasks.map((t) => (
        <option key={t._id} value={t._id}>
          {t.taskId} {t.title}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <Card title="Add Finish-to-Start Dependency">
        <ErrorAlert error={form.apiError} />
        <form onSubmit={onAdd} className="grid gap-3 md:grid-cols-3 md:items-end" noValidate>
          <Field label="Predecessor (must finish first)" name="predecessor" as="select" value={form.values.predecessor} onChange={form.onChange} error={form.errors.predecessor}>
            {taskOptions}
          </Field>
          <Field label="Successor (starts after)" name="successor" as="select" value={form.values.successor} onChange={form.onChange} error={form.errors.successor}>
            {taskOptions}
          </Field>
          <Button type="submit" disabled={form.submitting}>
            Add Dependency
          </Button>
        </form>
      </Card>
      <Card title="Dependencies">
        <ErrorAlert error={error || deps.error} />
        <DataTable
          label="Dependencies"
          rows={deps.data || []}
          columns={[
            { key: 'predecessor', header: 'Predecessor', render: (d) => `${d.predecessor.taskId} ${d.predecessor.title}` },
            { key: 'arrow', header: '', render: () => '→' },
            { key: 'successor', header: 'Successor', render: (d) => `${d.successor.taskId} ${d.successor.title}` },
            { key: 'type', header: 'Type', render: () => 'Finish-to-start' },
            { key: 'x', header: '', render: (d) => <Button size="sm" variant="secondary" onClick={() => setToDelete(d)}>Remove</Button> },
          ]}
        />
      </Card>
      <ConfirmDialog open={!!toDelete} title="Remove dependency" confirmLabel="Remove" variant="danger" onConfirm={remove} onCancel={() => setToDelete(null)}>
        {toDelete && `Remove the dependency ${toDelete.predecessor.taskId} → ${toDelete.successor.taskId}? The schedule will be recalculated.`}
      </ConfirmDialog>
    </div>
  );
}

function DelayPanel({ schedule }) {
  if (!schedule) return <Loading />;
  const delayed = schedule.tasks.filter((t) => t.delayDays > 0);
  return (
    <div className="space-y-6">
      <Card title="Project Completion Impact">
        <p className="text-sm text-slate-700">
          Planned completion <strong>{formatDate(schedule.summary.plannedCompletion)}</strong>, forecast completion{' '}
          <strong>{formatDate(schedule.summary.forecastCompletion)}</strong>, approved deadline <strong>{formatDate(schedule.summary.approvedDeadline)}</strong>.{' '}
          {schedule.summary.forecastVsDeadlineDays > 0 ? (
            <span className="font-semibold text-red-700">Forecast is {schedule.summary.forecastVsDeadlineDays} day(s) beyond the deadline.</span>
          ) : (
            <span className="font-semibold text-emerald-700">Forecast is within the deadline ({-schedule.summary.forecastVsDeadlineDays} day(s) of buffer).</span>
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500">Critical path: {schedule.criticalPath.join(' → ') || '—'}</p>
      </Card>
      <Card title="Delayed Activities and Propagation">
        <DataTable
          label="Delayed activities"
          rows={delayed}
          rowKey="id"
          emptyMessage="No delays detected."
          columns={[
            { key: 'taskId', header: 'Task', render: (t) => `${t.taskId} ${t.title}` },
            { key: 'status', header: 'Status', render: (t) => <StatusBadge value={t.status} /> },
            { key: 'plannedEnd', header: 'Planned end', render: (t) => formatDate(t.plannedEnd) },
            { key: 'forecastEnd', header: 'Forecast / actual end', render: (t) => formatDate(t.forecastEnd) },
            { key: 'delayDays', header: 'Delay', render: (t) => <span className="font-semibold text-red-700">{t.delayDays} d</span> },
            { key: 'delayCause', header: 'Cause' },
            { key: 'totalFloat', header: 'Float', render: (t) => `${t.totalFloat} d` },
            { key: 'completionImpactDays', header: 'Impact on completion', render: (t) => `${t.completionImpactDays} d` },
            {
              key: 'impactedTasks',
              header: 'Dependent tasks pushed',
              render: (t) => (t.impactedTasks.length ? t.impactedTasks.map((x) => `${x.taskId} (+${x.shiftDays}d)`).join(', ') : '—'),
            },
          ]}
        />
        <p className="mt-2 text-xs text-slate-500">
          Delay = forecast finish − planned finish. A slip only moves project completion by the amount that exceeds the task's float.
        </p>
      </Card>
    </div>
  );
}
