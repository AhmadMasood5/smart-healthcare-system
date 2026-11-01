import { useState } from 'react';
import { api } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useLoader } from '../utils/useLoader';
import { useForm } from '../utils/useForm';
import { rules, validate } from '../utils/validation';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Button, Card, ErrorAlert, Field, Loading, Modal, NoProject, PageHeader, StatCard, SuccessAlert, Tabs } from '../components/ui';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

const TABS = ['Requirements', 'Approved Scope', 'Work Breakdown Structure', 'Change Requests'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const WBS_TYPES = ['Deliverable', 'Sub-deliverable', 'Work Package'];
const opts = (arr) => arr.map((x) => ({ value: x, label: x }));

export default function ScopeManagement() {
  const { projectId } = useProject();
  const [tab, setTab] = useState(TABS[0]);
  if (!projectId) return <NoProject />;
  return (
    <div>
      <PageHeader title="Scope Management" subtitle="Requirements, approved scope, hierarchical WBS and change control." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Requirements' && <RequirementsPanel projectId={projectId} />}
      {tab === 'Approved Scope' && <ApprovedScopePanel projectId={projectId} />}
      {tab === 'Work Breakdown Structure' && <WbsPanel projectId={projectId} />}
      {tab === 'Change Requests' && <ChangeRequestsPanel projectId={projectId} />}
    </div>
  );
}

// ---------------- Requirements ----------------
const REQ_SCHEMA = { title: [rules.required('Title')], description: [rules.required('Description')] };

function RequirementsPanel({ projectId }) {
  const list = useLoader(() => api.requirements.list(projectId), [projectId]);
  const add = useForm({ title: '', description: '', priority: 'Medium' }, REQ_SCHEMA);
  const edit = useForm({ title: '', description: '', priority: 'Medium' }, REQ_SCHEMA);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  async function act(fn, success) {
    try {
      await fn();
      setError(null);
      setMessage(success);
      list.reload();
    } catch (err) {
      setError(err);
    }
  }

  async function onAdd(e) {
    e.preventDefault();
    if (await add.submit((v) => api.requirements.create({ ...v, project: projectId }))) {
      add.reset();
      setMessage('Requirement added with status Pending.');
      list.reload();
    }
  }

  async function onEdit(e) {
    e.preventDefault();
    if (await edit.submit((v) => api.requirements.update(editing._id, v))) {
      setEditing(null);
      list.reload();
    }
  }

  return (
    <div className="space-y-6">
      <SuccessAlert message={message} onClose={() => setMessage('')} />
      <ErrorAlert error={error || list.error} onClose={() => setError(null)} />
      <Card title="Requirements Register">
        <DataTable
          label="Requirements"
          rows={list.data || []}
          columns={[
            { key: 'reqId', header: 'ID' },
            { key: 'title', header: 'Title', render: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'description', header: 'Description' },
            {
              key: 'priority',
              header: 'Priority',
              render: (r) => (
                <select
                  aria-label={`Priority of ${r.reqId}`}
                  value={r.priority}
                  onChange={(e) => act(() => api.requirements.setPriority(r._id, e.target.value), `${r.reqId} priority set to ${e.target.value}.`)}
                  className="rounded border border-slate-300 px-1.5 py-1 text-xs"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              ),
            },
            { key: 'approvalStatus', header: 'Approval', render: (r) => <StatusBadge value={r.approvalStatus} /> },
            { key: 'source', header: 'Source', render: (r) => (r.changeRequest ? `${r.changeRequest.changeId} (${r.changeRequest.status})` : r.source) },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(r); edit.reset({ title: r.title, description: r.description, priority: r.priority }); }}>
                    Edit
                  </Button>
                  {r.approvalStatus !== 'Approved' && !r.changeRequest && (
                    <Button size="sm" variant="success" onClick={() => act(() => api.requirements.approve(r._id), `${r.reqId} approved and added to scope.`)}>
                      Approve
                    </Button>
                  )}
                  {r.approvalStatus !== 'Rejected' && !r.changeRequest && (
                    <Button size="sm" variant="danger" onClick={() => act(() => api.requirements.reject(r._id), `${r.reqId} rejected.`)}>
                      Reject
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
        <p className="mt-2 text-xs text-slate-500">Requirements raised by a change request are approved or rejected through that change request.</p>
      </Card>

      <Card title="Add Requirement">
        <ErrorAlert error={add.apiError} />
        <form onSubmit={onAdd} className="grid gap-3 md:grid-cols-4 md:items-end" noValidate>
          <Field label="Title" name="title" value={add.values.title} onChange={add.onChange} error={add.errors.title} />
          <Field label="Description" name="description" value={add.values.description} onChange={add.onChange} error={add.errors.description} className="md:col-span-2" />
          <Field label="Priority" name="priority" as="select" value={add.values.priority} onChange={add.onChange} options={opts(PRIORITIES)} />
          <Button type="submit" disabled={add.submitting}>
            Add Requirement
          </Button>
        </form>
      </Card>

      <Modal open={!!editing} title={`Edit ${editing ? editing.reqId : ''}`} onClose={() => setEditing(null)}>
        <ErrorAlert error={edit.apiError} />
        <form onSubmit={onEdit} className="space-y-3" noValidate>
          <Field label="Title" name="title" value={edit.values.title} onChange={edit.onChange} error={edit.errors.title} />
          <Field label="Description" name="description" as="textarea" value={edit.values.description} onChange={edit.onChange} error={edit.errors.description} />
          <Field label="Priority" name="priority" as="select" value={edit.values.priority} onChange={edit.onChange} options={opts(PRIORITIES)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------- Approved scope ----------------
function ApprovedScopePanel({ projectId }) {
  const scope = useLoader(() => api.requirements.scope(projectId), [projectId]);
  if (scope.loading && !scope.data) return <Loading />;
  if (scope.error) return <ErrorAlert error={scope.error} />;
  const { approved, excluded, counts } = scope.data;
  const cols = [
    { key: 'reqId', header: 'ID' },
    { key: 'title', header: 'Requirement' },
    { key: 'priority', header: 'Priority', render: (r) => <StatusBadge value={r.priority} /> },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="In approved scope" value={counts.approved} tone="good" testId="scope-approved-count" />
        <StatCard label="Pending (excluded)" value={counts.pending} tone={counts.pending ? 'warn' : 'default'} />
        <StatCard label="Rejected (excluded)" value={counts.rejected} />
      </div>
      <Card title="Approved Project Scope">
        <DataTable
          label="Approved scope"
          rows={approved}
          emptyMessage="No approved requirements."
          columns={[...cols, { key: 'wbsItems', header: 'WBS work packages', render: (r) => r.wbsItems.join(', ') || '—' }]}
        />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Excluded — Pending approval">
          <DataTable rows={excluded.pending} columns={cols} emptyMessage="None." />
        </Card>
        <Card title="Excluded — Rejected">
          <DataTable rows={excluded.rejected} columns={cols} emptyMessage="None." />
        </Card>
      </div>
    </div>
  );
}

// ---------------- WBS ----------------
const WBS_EMPTY = { title: '', description: '', type: 'Work Package', parent: '', requirement: '' };

function flatten(nodes, out = []) {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children, out);
  }
  return out;
}

function WbsPanel({ projectId }) {
  const tree = useLoader(() => api.wbs.tree(projectId), [projectId]);
  const approved = useLoader(() => api.requirements.list(projectId, 'Approved'), [projectId]);
  const [collapsed, setCollapsed] = useState({});
  const [editing, setEditing] = useState(null);
  const form = useForm(WBS_EMPTY, { title: [rules.required('Title')], type: [rules.required('Type')] });

  const flat = flatten(tree.data || []);
  const open = (node, parentId) => {
    setEditing(node || 'new');
    form.reset(
      node
        ? { title: node.title, description: node.description, type: node.type, parent: node.parent || '', requirement: node.requirement ? node.requirement._id : '' }
        : { ...WBS_EMPTY, parent: parentId || '' }
    );
  };

  async function save(e) {
    e.preventDefault();
    const body = { ...form.values, parent: form.values.parent || null, requirement: form.values.requirement || null };
    if (await form.submit(() => (editing === 'new' ? api.wbs.create({ ...body, project: projectId }) : api.wbs.update(editing._id, body)))) {
      setEditing(null);
      tree.reload();
    }
  }

  const renderNode = (node, depth) => {
    const isCollapsed = collapsed[node._id];
    return (
      <li key={node._id}>
        <div className="group flex flex-wrap items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50" style={{ paddingLeft: depth * 22 + 8 }}>
          <button
            type="button"
            className="w-5 text-slate-500"
            aria-label={isCollapsed ? `Expand ${node.title}` : `Collapse ${node.title}`}
            onClick={() => setCollapsed((c) => ({ ...c, [node._id]: !c[node._id] }))}
            disabled={!node.children.length}
          >
            {node.children.length ? (isCollapsed ? '▸' : '▾') : '·'}
          </button>
          <span className="w-16 font-mono text-xs text-slate-500">{node.code}</span>
          <span className={node.type === 'Work Package' ? 'text-slate-700' : 'font-semibold text-slate-900'}>{node.title}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">{node.type}</span>
          {node.requirement && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">{node.requirement.reqId}</span>}
          <span className="ml-auto flex gap-1 opacity-70 group-hover:opacity-100">
            <Button size="sm" variant="secondary" onClick={() => open(node)}>
              Edit
            </Button>
            {node.type !== 'Work Package' && (
              <Button size="sm" variant="secondary" onClick={() => open(null, node._id)}>
                + Child
              </Button>
            )}
          </span>
        </div>
        {!isCollapsed && node.children.length > 0 && <ul>{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <Card title="Work Breakdown Structure" actions={<Button onClick={() => open(null)}>Add Top-level Item</Button>}>
      <ErrorAlert error={tree.error} />
      {tree.loading && !tree.data ? <Loading /> : <ul aria-label="WBS tree" className="text-sm">{(tree.data || []).map((n) => renderNode(n, 0))}</ul>}
      {tree.data && !tree.data.length && <p className="text-sm text-slate-500">No WBS items yet.</p>}
      <Modal open={!!editing} title={editing === 'new' ? 'Add WBS Item' : 'Edit WBS Item'} onClose={() => setEditing(null)}>
        <ErrorAlert error={form.apiError} />
        <form onSubmit={save} className="space-y-3" noValidate>
          <Field label="Title" name="title" value={form.values.title} onChange={form.onChange} error={form.errors.title} />
          <Field label="Description" name="description" as="textarea" value={form.values.description} onChange={form.onChange} />
          <Field label="Type" name="type" as="select" value={form.values.type} onChange={form.onChange} options={opts(WBS_TYPES)} />
          <Field label="Parent item" name="parent" as="select" value={form.values.parent} onChange={form.onChange} error={form.errors.parent}>
            <option value="">(Top level)</option>
            {flat
              .filter((n) => n.type !== 'Work Package' && (!editing || editing === 'new' || n._id !== editing._id))
              .map((n) => (
                <option key={n._id} value={n._id}>
                  {n.code} {n.title}
                </option>
              ))}
          </Field>
          <Field label="Linked requirement (approved only)" name="requirement" as="select" value={form.values.requirement} onChange={form.onChange} error={form.errors.requirement}>
            <option value="">None</option>
            {(approved.data || []).map((r) => (
              <option key={r._id} value={r._id}>
                {r.reqId} {r.title}
              </option>
            ))}
          </Field>
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

// ---------------- Change requests ----------------
function ChangeRequestsPanel({ projectId }) {
  const { project, refreshProjects } = useProject();
  const list = useLoader(() => api.changeRequests.list(projectId), [projectId]);
  const [decision, setDecision] = useState(null); // { cr, action }
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  async function decide() {
    setBusy(true);
    try {
      const { cr, action } = decision;
      await (action === 'approve' ? api.changeRequests.approve(cr._id, notes) : api.changeRequests.reject(cr._id, notes));
      setMessage(
        action === 'approve'
          ? `${cr.changeId} approved: budget, duration, deadline, scope, WBS and schedule were updated.`
          : `${cr.changeId} rejected: the approved baseline is unchanged.`
      );
      setError(null);
      await refreshProjects();
      list.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      setDecision(null);
      setNotes('');
    }
  }

  return (
    <div className="space-y-4">
      <SuccessAlert message={message} onClose={() => setMessage('')} />
      <ErrorAlert error={error || list.error} onClose={() => setError(null)} />
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>New Change Request</Button>
      </div>
      {(list.data || []).map((cr) => (
        <Card
          key={cr._id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {cr.changeId} — {cr.title} <StatusBadge value={cr.status} />
            </span>
          }
          actions={
            cr.status === 'Pending' && (
              <>
                <Button variant="success" onClick={() => setDecision({ cr, action: 'approve' })}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => setDecision({ cr, action: 'reject' })}>
                  Reject
                </Button>
              </>
            )
          }
        >
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              <p>{cr.description}</p>
              <p className="text-slate-600">
                <strong>Justification:</strong> {cr.justification}
              </p>
              <div className="flex flex-wrap gap-4">
                <span>
                  Cost impact: <strong data-testid="cr-cost">{formatCurrency(cr.costImpact)}</strong>
                </span>
                <span>
                  Schedule impact: <strong data-testid="cr-weeks">{cr.scheduleImpactWeeks} weeks</strong>
                </span>
              </div>
              {cr.decisionDate && (
                <p className="text-xs text-slate-500">
                  Decided {formatDate(cr.decisionDate)} {cr.decisionNotes && `— ${cr.decisionNotes}`}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Proposed requirements</div>
                <ul>
                  {cr.proposedRequirements.map((r) => (
                    <li key={r._id} className="flex items-center gap-2">
                      {r.reqId} {r.title} <StatusBadge value={r.approvalStatus} />
                    </li>
                  ))}
                </ul>
              </div>
              {cr.proposedWork.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Additional work</div>
                  <ul className="text-slate-700">
                    {cr.proposedWork.map((w) => (
                      <li key={w.title}>
                        {w.title}: {w.estimatedDuration} days, {formatCurrency(w.plannedCost)}
                        {w.assignedTo && `, ${w.assignedTo.name}`}
                        {w.createdTask && <span className="text-emerald-700"> → scheduled as {w.createdTask.taskId}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500">
                    After: {cr.predecessorTasks.map((t) => t.taskId).join(', ') || 'project start'} · Before: {cr.successorTasks.map((t) => t.taskId).join(', ') || '—'}
                    {cr.wbsParent && ` · WBS parent: ${cr.wbsParent.title}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
      {list.data && !list.data.length && <p className="text-sm text-slate-500">No change requests.</p>}

      <ConfirmDialog
        open={!!decision}
        title={decision ? `${decision.action === 'approve' ? 'Approve' : 'Reject'} ${decision.cr.changeId}` : ''}
        confirmLabel={decision && decision.action === 'approve' ? 'Approve change' : 'Reject change'}
        variant={decision && decision.action === 'approve' ? 'success' : 'danger'}
        busy={busy}
        onConfirm={decide}
        onCancel={() => setDecision(null)}
      >
        {decision && project && decision.action === 'approve' && (
          <div className="mb-3 space-y-1">
            <p>Approving applies the change to the approved baseline:</p>
            <p>
              Budget: {formatCurrency(project.approvedBudget)} → <strong>{formatCurrency(project.approvedBudget + decision.cr.costImpact)}</strong>
            </p>
            <p>
              Duration: {project.durationWeeks} → <strong>{project.durationWeeks + decision.cr.scheduleImpactWeeks} weeks</strong>
            </p>
          </div>
        )}
        {decision && decision.action === 'reject' && <p className="mb-3">The approved baseline will not change and the proposed requirements will be rejected.</p>}
        <label htmlFor="decision-notes" className="block text-xs font-medium text-slate-600">
          Decision notes (optional)
        </label>
        <textarea id="decision-notes" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </ConfirmDialog>

      {creating && (
        <CreateChangeRequest
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setMessage('Change request submitted with status Pending.');
            list.reload();
          }}
        />
      )}
    </div>
  );
}

const ITEM_EMPTY = { title: '', description: '', priority: 'Medium', workTitle: '', estimatedDuration: '', plannedCost: '', assignedTo: '' };
const CR_SCHEMA = {
  title: [rules.required('Title')],
  description: [rules.required('Description')],
  justification: [rules.required('Justification')],
  costImpact: [rules.required('Cost impact'), rules.number('Cost impact', { min: 0 })],
  scheduleImpactWeeks: [rules.required('Schedule impact'), rules.number('Schedule impact', { min: 0, integer: true })],
};
const ITEM_SCHEMA = {
  title: [rules.required('Requirement title')],
  description: [rules.required('Requirement description')],
  estimatedDuration: [rules.number('Duration', { integer: true, positive: true })],
  plannedCost: [rules.number('Planned cost', { min: 0 })],
};

function CreateChangeRequest({ projectId, onClose, onCreated }) {
  const tasks = useLoader(() => api.tasks.list(projectId), [projectId]);
  const team = useLoader(() => api.teamMembers.list(projectId), [projectId]);
  const wbs = useLoader(() => api.wbs.tree(projectId), [projectId]);
  const form = useForm({ title: '', description: '', justification: '', costImpact: '', scheduleImpactWeeks: '', wbsParent: '' }, CR_SCHEMA);
  const [items, setItems] = useState([{ ...ITEM_EMPTY }]);
  const [itemErrors, setItemErrors] = useState([]);
  const [preds, setPreds] = useState([]);
  const [succs, setSuccs] = useState([]);

  const setItem = (i, key, value) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const toggle = (setter, id) => setter((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));

  async function onSubmit(e) {
    e.preventDefault();
    const errs = items.map((it) => validate(it, ITEM_SCHEMA));
    setItemErrors(errs);
    if (errs.some((x) => Object.keys(x).length)) return;
    const ok = await form.submit((v) =>
      api.changeRequests.create({
        ...v,
        project: projectId,
        costImpact: Number(v.costImpact),
        scheduleImpactWeeks: Number(v.scheduleImpactWeeks),
        wbsParent: v.wbsParent || null,
        predecessorTasks: preds,
        successorTasks: succs,
        proposedItems: items.map((it) => ({
          ...it,
          estimatedDuration: it.estimatedDuration === '' ? undefined : Number(it.estimatedDuration),
          plannedCost: it.plannedCost === '' ? undefined : Number(it.plannedCost),
          assignedTo: it.assignedTo || null,
        })),
      })
    );
    if (ok) onCreated();
  }

  const taskChecks = (selected, setter, label) => (
    <fieldset>
      <legend className="text-xs font-medium text-slate-600">{label}</legend>
      <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-slate-200 p-2 text-xs">
        {(tasks.data || []).map((t) => (
          <label key={t._id} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.includes(t._id)} onChange={() => toggle(setter, t._id)} />
            {t.taskId} {t.title}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <Modal open title="New Change Request" onClose={onClose} wide>
      <ErrorAlert error={form.apiError} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title" name="title" value={form.values.title} onChange={form.onChange} error={form.errors.title} className="md:col-span-2" />
          <Field label="Description" name="description" as="textarea" value={form.values.description} onChange={form.onChange} error={form.errors.description} />
          <Field label="Justification" name="justification" as="textarea" value={form.values.justification} onChange={form.onChange} error={form.errors.justification} />
          <Field label="Cost impact (PKR)" name="costImpact" type="number" min="0" value={form.values.costImpact} onChange={form.onChange} error={form.errors.costImpact} />
          <Field label="Schedule impact (weeks)" name="scheduleImpactWeeks" type="number" min="0" step="1" value={form.values.scheduleImpactWeeks} onChange={form.onChange} error={form.errors.scheduleImpactWeeks} />
          <Field label="WBS parent for new work" name="wbsParent" as="select" value={form.values.wbsParent} onChange={form.onChange}>
            <option value="">(Top level)</option>
            {flatten(wbs.data || [])
              .filter((n) => n.type !== 'Work Package')
              .map((n) => (
                <option key={n._id} value={n._id}>
                  {n.code} {n.title}
                </option>
              ))}
          </Field>
          <div />
          {taskChecks(preds, setPreds, 'New work starts after (predecessors)')}
          {taskChecks(succs, setSuccs, 'New work must finish before (successors)')}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Proposed requirements and work</h4>
            <Button size="sm" variant="secondary" onClick={() => setItems((a) => [...a, { ...ITEM_EMPTY }])}>
              + Add requirement
            </Button>
          </div>
          {items.map((it, i) => {
            const er = itemErrors[i] || {};
            return (
              <div key={i} className="mb-3 grid gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-3">
                <Field label="Requirement title" name={`title-${i}`} value={it.title} onChange={(e) => setItem(i, 'title', e.target.value)} error={er.title} />
                <Field label="Description" name={`desc-${i}`} value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} error={er.description} />
                <Field label="Priority" name={`prio-${i}`} as="select" value={it.priority} onChange={(e) => setItem(i, 'priority', e.target.value)} options={opts(PRIORITIES)} />
                <Field label="Work package title" name={`work-${i}`} value={it.workTitle} onChange={(e) => setItem(i, 'workTitle', e.target.value)} placeholder="e.g. AI Module Development" />
                <Field label="Duration (days)" name={`dur-${i}`} type="number" min="1" value={it.estimatedDuration} onChange={(e) => setItem(i, 'estimatedDuration', e.target.value)} error={er.estimatedDuration} />
                <Field label="Planned cost (PKR)" name={`cost-${i}`} type="number" min="0" value={it.plannedCost} onChange={(e) => setItem(i, 'plannedCost', e.target.value)} error={er.plannedCost} />
                <Field label="Assigned to" name={`member-${i}`} as="select" value={it.assignedTo} onChange={(e) => setItem(i, 'assignedTo', e.target.value)}>
                  <option value="">Unassigned</option>
                  {(team.data || []).map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </Field>
                {items.length > 1 && (
                  <div className="flex items-end">
                    <Button size="sm" variant="secondary" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.submitting}>
            Submit Change Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
