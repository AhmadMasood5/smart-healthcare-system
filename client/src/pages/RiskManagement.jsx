import { useState } from 'react';
import { api } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useLoader } from '../utils/useLoader';
import { useForm } from '../utils/useForm';
import { rules } from '../utils/validation';
import { Button, Card, ErrorAlert, Field, Loading, Modal, NoProject, PageHeader, Tabs } from '../components/ui';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import RiskMatrix from '../components/RiskMatrix';

const TABS = ['Risk Register', 'Prioritization Matrix', 'PDPC'];
const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

export default function RiskManagement() {
  const { projectId } = useProject();
  const [tab, setTab] = useState(TABS[0]);
  if (!projectId) return <NoProject />;
  return (
    <div>
      <PageHeader title="Risk Management" subtitle="Risk register, 5×5 prioritization matrix and Process Decision Program Chart (PDPC)." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'Risk Register' && <RiskRegister projectId={projectId} />}
      {tab === 'Prioritization Matrix' && <MatrixPanel projectId={projectId} />}
      {tab === 'PDPC' && <PdpcPanel projectId={projectId} />}
    </div>
  );
}

const RISK_EMPTY = { title: '', description: '', likelihood: '3', impact: '3' };
const RISK_SCHEMA = {
  title: [rules.required('Title')],
  description: [rules.required('Description')],
  likelihood: [rules.required('Likelihood'), rules.number('Likelihood', { min: 1, max: 5, integer: true })],
  impact: [rules.required('Impact'), rules.number('Impact', { min: 1, max: 5, integer: true })],
};

function RiskRegister({ projectId }) {
  const list = useLoader(() => api.risks.list(projectId), [projectId]);
  const form = useForm(RISK_EMPTY, RISK_SCHEMA);
  const [editing, setEditing] = useState(null);

  const open = (r) => {
    setEditing(r || 'new');
    form.reset(r ? { title: r.title, description: r.description, likelihood: String(r.likelihood), impact: String(r.impact) } : RISK_EMPTY);
  };

  async function save(e) {
    e.preventDefault();
    const ok = await form.submit((v) => {
      const body = { ...v, likelihood: Number(v.likelihood), impact: Number(v.impact) };
      return editing === 'new' ? api.risks.create({ ...body, project: projectId }) : api.risks.update(editing._id, body);
    });
    if (ok) {
      setEditing(null);
      list.reload();
    }
  }

  return (
    <Card title="Risk Register (ranked by score)" actions={<Button onClick={() => open(null)}>Register Risk</Button>}>
      <ErrorAlert error={list.error} />
      <DataTable
        label="Risk register"
        rows={list.data || []}
        columns={[
          { key: 'rank', header: 'Rank' },
          { key: 'riskId', header: 'ID' },
          { key: 'title', header: 'Risk', render: (r) => <span className="font-medium">{r.title}</span> },
          { key: 'description', header: 'Description' },
          { key: 'likelihood', header: 'Likelihood' },
          { key: 'impact', header: 'Impact' },
          { key: 'score', header: 'Score (L×I)', render: (r) => <strong>{r.score}</strong> },
          { key: 'priority', header: 'Priority', render: (r) => <StatusBadge value={r.priority} /> },
          { key: 'x', header: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => open(r)}>Edit</Button> },
        ]}
      />
      <p className="mt-2 text-xs text-slate-500">Score = Likelihood × Impact (calculated by the server). Priority: High ≥ 15, Medium 8–14, Low ≤ 7.</p>
      <Modal open={!!editing} title={editing === 'new' ? 'Register Risk' : `Edit ${editing ? editing.riskId : ''}`} onClose={() => setEditing(null)}>
        <ErrorAlert error={form.apiError} />
        <form onSubmit={save} className="space-y-3" noValidate>
          <Field label="Title" name="title" value={form.values.title} onChange={form.onChange} error={form.errors.title} />
          <Field label="Description" name="description" as="textarea" value={form.values.description} onChange={form.onChange} error={form.errors.description} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Likelihood (1–5)" name="likelihood" as="select" value={form.values.likelihood} onChange={form.onChange} options={SCALE} error={form.errors.likelihood} />
            <Field label="Impact (1–5)" name="impact" as="select" value={form.values.impact} onChange={form.onChange} options={SCALE} error={form.errors.impact} />
          </div>
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

function MatrixPanel({ projectId }) {
  const matrix = useLoader(() => api.risks.matrix(projectId), [projectId]);
  if (matrix.loading && !matrix.data) return <Loading />;
  if (matrix.error) return <ErrorAlert error={matrix.error} />;
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card title="5×5 Risk Prioritization Matrix" className="xl:col-span-2">
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#d03b3b', opacity: 0.5 }} /> High (≥15)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#fab219', opacity: 0.6 }} /> Medium (8–14)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#0ca30c', opacity: 0.5 }} /> Low (≤7)</span>
          <span>● number = priority rank</span>
        </div>
        <RiskMatrix matrix={matrix.data} />
      </Card>
      <Card title="Priority Ranking">
        <ol className="space-y-2 text-sm" aria-label="Risk ranking">
          {matrix.data.ranked.map((r) => (
            <li key={r._id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
              <span>
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{r.rank}</span>
                {r.title}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {r.likelihood}×{r.impact} = <strong>{r.score}</strong>
                </span>
                <StatusBadge value={r.priority} />
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

const RESPONSE_EMPTY = { risk: '', potentialProblem: '', preventiveAction: '', correctiveAction: '' };
const RESPONSE_SCHEMA = {
  risk: [rules.required('Related risk')],
  potentialProblem: [rules.required('Potential problem')],
  preventiveAction: [rules.required('Preventive action')],
  correctiveAction: [rules.required('Corrective action')],
};

function PdpcPanel({ projectId }) {
  const pdpc = useLoader(() => api.riskResponses.pdpc(projectId), [projectId]);
  const form = useForm(RESPONSE_EMPTY, RESPONSE_SCHEMA);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState(null);

  const open = (risk, problem) => {
    setEditing(problem || 'new');
    form.reset(problem ? { risk: risk._id, potentialProblem: problem.potentialProblem, preventiveAction: problem.preventiveAction, correctiveAction: problem.correctiveAction } : { ...RESPONSE_EMPTY, risk: risk ? risk._id : '' });
  };

  async function save(e) {
    e.preventDefault();
    const ok = await form.submit((v) => (editing === 'new' ? api.riskResponses.create({ ...v, project: projectId }) : api.riskResponses.update(editing._id, v)));
    if (ok) {
      setEditing(null);
      pdpc.reload();
    }
  }

  async function remove() {
    try {
      await api.riskResponses.remove(toDelete._id);
      pdpc.reload();
    } catch (err) {
      setError(err);
    }
    setToDelete(null);
  }

  if (pdpc.loading && !pdpc.data) return <Loading />;
  const data = pdpc.data;

  return (
    <Card title="Process Decision Program Chart" actions={<Button onClick={() => open(null)}>Add Countermeasure</Button>}>
      <ErrorAlert error={error || pdpc.error} />
      {data && (
        <div className="overflow-x-auto" data-testid="pdpc">
          <div className="mx-auto mb-4 w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Objective: {data.objective}</div>
          <div className="space-y-4">
            {data.risks.map((risk) => (
              <div key={risk._id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Risk</span>
                  <span className="font-semibold text-slate-900">
                    {risk.riskId} {risk.title}
                  </span>
                  <StatusBadge value={risk.priority} />
                  <span className="text-xs text-slate-500">score {risk.score}</span>
                  <Button size="sm" variant="secondary" className="ml-auto" onClick={() => open(risk)}>
                    + Problem
                  </Button>
                </div>
                {risk.problems.length ? (
                  <ul className="space-y-3 border-l-2 border-slate-200 pl-4">
                    {risk.problems.map((p) => (
                      <li key={p._id} className="grid gap-2 md:grid-cols-3">
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm">
                          <div className="text-[10px] font-semibold uppercase text-amber-800">Potential problem</div>
                          {p.potentialProblem}
                          <div className="mt-1 flex gap-1">
                            <Button size="sm" variant="secondary" onClick={() => open(risk, p)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setToDelete(p)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-sm">
                          <div className="text-[10px] font-semibold uppercase text-emerald-800">Preventive action</div>
                          {p.preventiveAction}
                        </div>
                        <div className="rounded-md border border-sky-300 bg-sky-50 p-2 text-sm">
                          <div className="text-[10px] font-semibold uppercase text-sky-800">Corrective action</div>
                          {p.correctiveAction}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">No countermeasures recorded for this risk yet.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <Modal open={!!editing} title={editing === 'new' ? 'Add PDPC Countermeasure' : 'Edit PDPC Countermeasure'} onClose={() => setEditing(null)}>
        <ErrorAlert error={form.apiError} />
        <form onSubmit={save} className="space-y-3" noValidate>
          <Field label="Related risk" name="risk" as="select" value={form.values.risk} onChange={form.onChange} error={form.errors.risk}>
            <option value="">Select risk…</option>
            {(data ? data.risks : []).map((r) => (
              <option key={r._id} value={r._id}>
                {r.riskId} {r.title}
              </option>
            ))}
          </Field>
          <Field label="Potential problem" name="potentialProblem" value={form.values.potentialProblem} onChange={form.onChange} error={form.errors.potentialProblem} />
          <Field label="Preventive action" name="preventiveAction" as="textarea" value={form.values.preventiveAction} onChange={form.onChange} error={form.errors.preventiveAction} />
          <Field label="Corrective action" name="correctiveAction" as="textarea" value={form.values.correctiveAction} onChange={form.onChange} error={form.errors.correctiveAction} />
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
      <ConfirmDialog open={!!toDelete} title="Delete countermeasure" confirmLabel="Delete" variant="danger" onConfirm={remove} onCancel={() => setToDelete(null)}>
        {toDelete && `Delete the PDPC branch "${toDelete.potentialProblem}"?`}
      </ConfirmDialog>
    </Card>
  );
}
