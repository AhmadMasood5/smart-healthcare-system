import { useState } from 'react';
import { api } from '../services/api';
import { useLoader } from '../utils/useLoader';
import { useForm } from '../utils/useForm';
import { rules } from '../utils/validation';
import { Button, Card, ErrorAlert, Field, Modal, SuccessAlert } from './ui';
import DataTable from './DataTable';
import StatusBadge from './StatusBadge';

const ROLES = ['Project Manager', 'Backend Developer', 'Frontend Developer', 'Database Developer', 'QA Engineer'];
const EMPTY = { name: '', role: 'Backend Developer', responsibilities: '' };
const SCHEMA = { name: [rules.required('Member name')], role: [rules.required('Role')], responsibilities: [rules.required('Responsibilities')] };

// Team members, their responsibilities and the project activities assigned to them.
export default function TeamPanel({ projectId, onChange }) {
  const team = useLoader(() => api.teamMembers.list(projectId), [projectId]);
  const tasks = useLoader(() => api.tasks.list(projectId), [projectId]);
  const [editing, setEditing] = useState(null); // null | 'new' | member
  const form = useForm(EMPTY, SCHEMA);
  const assign = useForm({ task: '', member: '' }, { task: [rules.required('Task')], member: [rules.required('Team member')] });
  const [message, setMessage] = useState('');

  const open = (member) => {
    setEditing(member || 'new');
    form.reset(member ? { name: member.name, role: member.role, responsibilities: member.responsibilities } : EMPTY);
  };

  async function save(e) {
    e.preventDefault();
    const ok = await form.submit((v) => (editing === 'new' ? api.teamMembers.create({ ...v, project: projectId }) : api.teamMembers.update(editing._id, v)));
    if (ok) {
      setEditing(null);
      setMessage('Team member saved.');
      team.reload();
    }
  }

  async function doAssign(e) {
    e.preventDefault();
    const ok = await assign.submit((v) => api.tasks.update(v.task, { assignedTo: v.member }));
    if (ok) {
      setMessage('Task assignment updated.');
      assign.reset();
      team.reload();
      tasks.reload();
      if (onChange) onChange();
    }
  }

  return (
    <div className="space-y-6">
      <SuccessAlert message={message} onClose={() => setMessage('')} />
      <ErrorAlert error={team.error || tasks.error} />
      <Card title="Team Members & Responsibilities" actions={<Button onClick={() => open(null)}>Add Member</Button>}>
        <DataTable
          label="Team members"
          rows={team.data || []}
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'role', header: 'Role' },
            { key: 'responsibilities', header: 'Responsibilities' },
            {
              key: 'assignedTasks',
              header: 'Assigned Activities',
              render: (m) =>
                m.assignedTasks.length ? (
                  <ul className="space-y-1">
                    {m.assignedTasks.map((t) => (
                      <li key={t._id} className="flex items-center gap-2 text-xs">
                        <span>
                          {t.taskId} {t.title}
                        </span>
                        <StatusBadge value={t.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-slate-400">None</span>
                ),
            },
            { key: 'actions', header: '', render: (m) => <Button size="sm" variant="secondary" onClick={() => open(m)}>Edit</Button> },
          ]}
        />
      </Card>

      <Card title="Assign Team Member to Activity">
        <ErrorAlert error={assign.apiError} />
        <form onSubmit={doAssign} className="grid gap-3 md:grid-cols-3 md:items-end">
          <Field label="Task" name="task" as="select" value={assign.values.task} onChange={assign.onChange} error={assign.errors.task}>
            <option value="">Select task…</option>
            {(tasks.data || []).map((t) => (
              <option key={t._id} value={t._id}>
                {t.taskId} {t.title} {t.assignedTo ? `(now: ${t.assignedTo.name})` : '(unassigned)'}
              </option>
            ))}
          </Field>
          <Field label="Team member" name="member" as="select" value={assign.values.member} onChange={assign.onChange} error={assign.errors.member}>
            <option value="">Select member…</option>
            {(team.data || []).map((m) => (
              <option key={m._id} value={m._id}>
                {m.name} — {m.role}
              </option>
            ))}
          </Field>
          <Button type="submit" disabled={assign.submitting}>
            Assign
          </Button>
        </form>
      </Card>

      <Modal open={!!editing} title={editing === 'new' ? 'Add Team Member' : 'Edit Team Member'} onClose={() => setEditing(null)}>
        <ErrorAlert error={form.apiError} />
        <form onSubmit={save} className="space-y-3">
          <Field label="Name" name="name" value={form.values.name} onChange={form.onChange} error={form.errors.name} />
          <Field label="Role" name="role" as="select" value={form.values.role} onChange={form.onChange} error={form.errors.role} options={ROLES.map((r) => ({ value: r, label: r }))} />
          <Field label="Responsibilities" name="responsibilities" as="textarea" value={form.values.responsibilities} onChange={form.onChange} error={form.errors.responsibilities} />
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
    </div>
  );
}
