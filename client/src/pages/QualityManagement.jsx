import { useState } from 'react';
import { api } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useLoader } from '../utils/useLoader';
import { useForm } from '../utils/useForm';
import { rules } from '../utils/validation';
import { Button, Card, ErrorAlert, Field, Modal, NoProject, PageHeader, StatCard, SuccessAlert, Tabs } from '../components/ui';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

const TABS = ['Defect Tracking', 'Quality Checklists'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const opts = (arr) => arr.map((x) => ({ value: x, label: x }));

export default function QualityManagement() {
  const { projectId } = useProject();
  const [tab, setTab] = useState(TABS[0]);
  const stats = useLoader(() => (projectId ? api.defects.stats(projectId) : Promise.resolve(null)), [projectId]);
  if (!projectId) return <NoProject />;
  const s = stats.data;
  return (
    <div>
      <PageHeader title="Quality Management" subtitle="Defect tracking and inspection / testing checklists." />
      <ErrorAlert error={stats.error} />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Total defects" value={s.total} />
          <StatCard label="Unresolved" value={s.unresolved} tone={s.unresolved ? 'warn' : 'good'} />
          <StatCard label="Unresolved critical" value={s.unresolvedCritical} tone={s.unresolvedCritical ? 'bad' : 'good'} testId="quality-critical" />
          <StatCard label="Resolved / closed" value={s.resolved} tone="good" />
          <StatCard label="Critical (all)" value={s.bySeverity.Critical} />
        </div>
      )}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Defect Tracking' && <DefectsPanel projectId={projectId} onChange={stats.reload} />}
      {tab === 'Quality Checklists' && <ChecklistPanel projectId={projectId} />}
    </div>
  );
}

const DEFECT_EMPTY = { title: '', description: '', severity: 'Medium', status: 'Open', assignedTo: '', relatedTask: '', relatedDeliverable: '' };
const DEFECT_SCHEMA = {
  title: [rules.required('Title')],
  description: [rules.required('Description')],
  severity: [rules.required('Severity')],
  relatedTask: [(v, all) => (!v && !all.relatedDeliverable ? 'Select a related task or deliverable' : null)],
};

function DefectsPanel({ projectId, onChange }) {
  const list = useLoader(() => api.defects.list(projectId), [projectId]);
  const team = useLoader(() => api.teamMembers.list(projectId), [projectId]);
  const tasks = useLoader(() => api.tasks.list(projectId), [projectId]);
  const wbs = useLoader(() => api.wbs.list(projectId), [projectId]);
  const form = useForm(DEFECT_EMPTY, DEFECT_SCHEMA);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  const open = (d) => {
    setEditing(d || 'new');
    form.reset(
      d
        ? {
            title: d.title,
            description: d.description,
            severity: d.severity,
            status: d.status,
            assignedTo: d.assignedTo ? d.assignedTo._id : '',
            relatedTask: d.relatedTask ? d.relatedTask._id : '',
            relatedDeliverable: d.relatedDeliverable ? d.relatedDeliverable._id : '',
          }
        : DEFECT_EMPTY
    );
  };

  async function save(e) {
    e.preventDefault();
    const ok = await form.submit((v) => {
      const body = { ...v, assignedTo: v.assignedTo || null, relatedTask: v.relatedTask || null, relatedDeliverable: v.relatedDeliverable || null };
      return editing === 'new' ? api.defects.create({ ...body, project: projectId }) : api.defects.update(editing._id, body);
    });
    if (ok) {
      setMessage(editing === 'new' ? 'Defect reported.' : 'Defect updated.');
      setEditing(null);
      list.reload();
      onChange();
    }
  }

  return (
    <Card title="Defects" actions={<Button onClick={() => open(null)}>Report Defect</Button>}>
      <SuccessAlert message={message} onClose={() => setMessage('')} />
      <ErrorAlert error={list.error} />
      <DataTable
        label="Defects"
        rows={list.data || []}
        columns={[
          { key: 'defectId', header: 'ID' },
          { key: 'title', header: 'Title', render: (d) => <span className="font-medium">{d.title}</span> },
          { key: 'description', header: 'Description' },
          { key: 'severity', header: 'Severity', render: (d) => <StatusBadge value={d.severity} /> },
          { key: 'status', header: 'Resolution', render: (d) => <StatusBadge value={d.status} /> },
          { key: 'assignedTo', header: 'Assigned', render: (d) => (d.assignedTo ? d.assignedTo.name : '—') },
          {
            key: 'related',
            header: 'Related task / deliverable',
            render: (d) => [d.relatedTask && `${d.relatedTask.taskId} ${d.relatedTask.title}`, d.relatedDeliverable && d.relatedDeliverable.title].filter(Boolean).join(' · '),
          },
          { key: 'x', header: '', render: (d) => <Button size="sm" variant="secondary" onClick={() => open(d)}>Update</Button> },
        ]}
      />
      <Modal open={!!editing} title={editing === 'new' ? 'Report Defect' : `Update ${editing ? editing.defectId : ''}`} onClose={() => setEditing(null)} wide>
        <ErrorAlert error={form.apiError} />
        <form onSubmit={save} className="grid gap-3 md:grid-cols-2" noValidate>
          <Field label="Title" name="title" value={form.values.title} onChange={form.onChange} error={form.errors.title} className="md:col-span-2" />
          <Field label="Description" name="description" as="textarea" value={form.values.description} onChange={form.onChange} error={form.errors.description} className="md:col-span-2" />
          <Field label="Severity" name="severity" as="select" value={form.values.severity} onChange={form.onChange} options={opts(SEVERITIES)} error={form.errors.severity} />
          <Field label="Resolution status" name="status" as="select" value={form.values.status} onChange={form.onChange} options={opts(STATUSES)} error={form.errors.status} />
          <Field label="Assigned member" name="assignedTo" as="select" value={form.values.assignedTo} onChange={form.onChange} error={form.errors.assignedTo}>
            <option value="">Unassigned</option>
            {(team.data || []).map((m) => (
              <option key={m._id} value={m._id}>
                {m.name} — {m.role}
              </option>
            ))}
          </Field>
          <Field label="Related task" name="relatedTask" as="select" value={form.values.relatedTask} onChange={form.onChange} error={form.errors.relatedTask}>
            <option value="">None</option>
            {(tasks.data || []).map((t) => (
              <option key={t._id} value={t._id}>
                {t.taskId} {t.title}
              </option>
            ))}
          </Field>
          <Field label="Related deliverable (WBS)" name="relatedDeliverable" as="select" value={form.values.relatedDeliverable} onChange={form.onChange} error={form.errors.relatedDeliverable}>
            <option value="">None</option>
            {(wbs.data || []).map((w) => (
              <option key={w._id} value={w._id}>
                {w.title}
              </option>
            ))}
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
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

function ChecklistPanel({ projectId }) {
  const list = useLoader(() => api.checklists.list(projectId), [projectId]);
  const summary = useLoader(() => api.checklists.summary(projectId), [projectId]);
  const form = useForm({ deliverable: '', item: '' }, { deliverable: [rules.required('Deliverable')], item: [rules.required('Checklist item')] });
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const reload = () => {
    list.reload();
    summary.reload();
  };
  const draftOf = (row) => ({ inspectionResult: row.inspectionResult, status: row.status, remarks: row.remarks, ...drafts[row._id] });
  const setDraft = (id, key, value) => setDrafts((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  async function saveRow(row) {
    try {
      await api.checklists.update(row._id, draftOf(row));
      setDrafts((d) => ({ ...d, [row._id]: undefined }));
      setError(null);
      reload();
    } catch (err) {
      setError(err);
    }
  }

  async function onAdd(e) {
    e.preventDefault();
    if (await form.submit((v) => api.checklists.create({ ...v, project: projectId }))) {
      form.setValues((v) => ({ ...v, item: '' }));
      reload();
    }
  }

  async function remove() {
    try {
      await api.checklists.remove(toDelete._id);
      reload();
    } catch (err) {
      setError(err);
    }
    setToDelete(null);
  }

  const groups = {};
  for (const row of list.data || []) (groups[row.deliverable] = groups[row.deliverable] || []).push(row);

  return (
    <div className="space-y-6">
      <ErrorAlert error={error || list.error} onClose={() => setError(null)} />
      {summary.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Checklist items" value={summary.data.total} />
          <StatCard label="Passed" value={summary.data.passed} tone="good" />
          <StatCard label="Failed" value={summary.data.failed} tone={summary.data.failed ? 'bad' : 'good'} />
          <StatCard label="Not inspected" value={summary.data.notInspected} />
        </div>
      )}
      {Object.entries(groups).map(([deliverable, rows]) => (
        <Card key={deliverable} title={`Inspection checklist — ${deliverable}`}>
          <DataTable
            label={`Checklist ${deliverable}`}
            rows={rows}
            columns={[
              { key: 'item', header: 'Checklist item' },
              {
                key: 'inspectionResult',
                header: 'Inspection result',
                render: (r) => (
                  <select aria-label={`Result for ${r.item}`} className="rounded border border-slate-300 px-1.5 py-1 text-xs" value={draftOf(r).inspectionResult} onChange={(e) => setDraft(r._id, 'inspectionResult', e.target.value)}>
                    {['Not Inspected', 'Pass', 'Fail'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <select aria-label={`Status for ${r.item}`} className="rounded border border-slate-300 px-1.5 py-1 text-xs" value={draftOf(r).status} onChange={(e) => setDraft(r._id, 'status', e.target.value)}>
                    {['Pending', 'Completed'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                ),
              },
              {
                key: 'remarks',
                header: 'Remarks',
                render: (r) => (
                  <input aria-label={`Remarks for ${r.item}`} className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1 text-xs" value={draftOf(r).remarks} onChange={(e) => setDraft(r._id, 'remarks', e.target.value)} />
                ),
              },
              { key: 'current', header: 'Recorded', render: (r) => <StatusBadge value={r.inspectionResult} /> },
              {
                key: 'x',
                header: '',
                render: (r) => (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => saveRow(r)} disabled={!drafts[r._id]}>
                      Save
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setToDelete(r)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      ))}
      <Card title="Add Checklist Item">
        <ErrorAlert error={form.apiError} />
        <form onSubmit={onAdd} className="grid gap-3 md:grid-cols-3 md:items-end" noValidate>
          <Field label="Deliverable" name="deliverable" value={form.values.deliverable} onChange={form.onChange} error={form.errors.deliverable} list="deliverables" />
          <datalist id="deliverables">
            {Object.keys(groups).map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <Field label="Checklist item" name="item" value={form.values.item} onChange={form.onChange} error={form.errors.item} />
          <Button type="submit" disabled={form.submitting}>
            Add Item
          </Button>
        </form>
      </Card>
      <ConfirmDialog open={!!toDelete} title="Delete checklist item" confirmLabel="Delete" variant="danger" onConfirm={remove} onCancel={() => setToDelete(null)}>
        {toDelete && `Delete "${toDelete.item}"?`}
      </ConfirmDialog>
    </div>
  );
}
