import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useLoader } from '../utils/useLoader';
import { useForm } from '../utils/useForm';
import { rules } from '../utils/validation';
import { formatCurrency, formatDate, formatIndex } from '../utils/formatters';
import { Button, Card, ErrorAlert, Field, Loading, NoProject, PageHeader, StatCard, SuccessAlert, WarningList } from '../components/ui';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';

const tone = (v) => (v === null ? 'default' : v < 1 ? 'bad' : 'good');
const compact = (v) => `${(v / 1000000).toFixed(2)}M`;

export default function CostManagement() {
  const { projectId } = useProject();
  const [reportDate, setReportDate] = useState('');
  const evm = useLoader(() => (projectId ? api.evm(projectId, reportDate) : Promise.resolve(null)), [projectId, reportDate]);
  const costs = useLoader(() => (projectId ? api.activityCosts.list(projectId) : Promise.resolve([])), [projectId]);

  if (!projectId) return <NoProject />;
  const refresh = () => {
    evm.reload();
    costs.reload();
  };
  const d = evm.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cost Management"
        subtitle="Planned activity costs, actual expenditure and Earned Value Management — all indicators calculated by the backend."
        actions={
          <div className="flex items-end gap-2">
            <Field label="Reporting date" name="reportDate" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            {reportDate && (
              <Button variant="secondary" onClick={() => setReportDate('')}>
                Today
              </Button>
            )}
          </div>
        }
      />
      <ErrorAlert error={evm.error} />
      {!d ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Approved budget" value={formatCurrency(d.approvedBudget)} testId="cost-budget" />
            <StatCard
              label="Total planned activity cost"
              value={formatCurrency(d.totalPlannedCost)}
              hint={d.unallocatedBudget >= 0 ? `${formatCurrency(d.unallocatedBudget)} unallocated` : `${formatCurrency(-d.unallocatedBudget)} over budget`}
              tone={d.unallocatedBudget < 0 ? 'bad' : 'default'}
            />
            <StatCard label="Actual expenditure" value={formatCurrency(d.actualExpenditure)} hint={`${d.budgetUtilisationPercent}% of budget`} />
            <StatCard label="Remaining budget" value={formatCurrency(d.remainingBudget)} tone={d.remainingBudget < 0 ? 'bad' : 'good'} />
          </div>

          <Card title={`Earned Value Management (as of ${formatDate(d.reportDate)})`}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Planned Value (PV)" value={formatCurrency(d.pv)} testId="evm-pv" />
              <StatCard label="Earned Value (EV)" value={formatCurrency(d.ev)} testId="evm-ev" />
              <StatCard label="Actual Cost (AC)" value={formatCurrency(d.ac)} testId="evm-ac" />
              <StatCard label="CPI = EV / AC" value={formatIndex(d.cpi)} hint={d.cpiStatus} tone={tone(d.cpi)} testId="evm-cpi" />
              <StatCard label="SPI = EV / PV" value={formatIndex(d.spi)} hint={d.spiStatus} tone={tone(d.spi)} testId="evm-spi" />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div style={{ height: 240 }} aria-label="PV, EV and AC compared with the approved budget">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'PV', value: d.pv },
                      { name: 'EV', value: d.ev },
                      { name: 'AC', value: d.ac },
                    ]}
                    margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#334155' }} />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#64748b' }} width={55} domain={[0, Math.max(d.approvedBudget, d.ac) * 1.05]} />
                    <Tooltip formatter={(v) => formatCurrency(v)} cursor={{ fill: 'rgba(148,163,184,0.15)' }} />
                    <ReferenceLine y={d.approvedBudget} stroke="#d03b3b" strokeDasharray="5 4" label={{ value: 'Approved budget', position: 'insideTopRight', fontSize: 10, fill: '#d03b3b' }} />
                    <Bar dataKey="value" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
                      <LabelList dataKey="value" position="top" formatter={compact} style={{ fontSize: 11, fill: '#334155' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Automatic warnings</h3>
                <WarningList warnings={d.warnings} />
                <p className="mt-3 text-xs text-slate-500">
                  Thresholds: CPI or SPI below {d.thresholds.cpi.warning} → warning, below {d.thresholds.cpi.critical} → critical; actual expenditure above the approved
                  budget → budget overrun.
                </p>
              </div>
            </div>
          </Card>

          <PlannedCosts projectId={projectId} evm={d} costs={costs.data || []} onChange={refresh} />
          <Expenditures projectId={projectId} tasks={d.breakdown} total={d.actualExpenditure} onChange={refresh} />

          <Card title="EVM Breakdown by Task">
            <DataTable
              label="EVM breakdown"
              rowKey="taskId"
              rows={d.breakdown}
              columns={[
                { key: 'taskId', header: 'Task', render: (t) => `${t.taskId} ${t.title}` },
                { key: 'plannedCost', header: 'Planned cost', render: (t) => formatCurrency(t.plannedCost) },
                { key: 'plannedPercent', header: 'Planned % at date', render: (t) => `${t.plannedPercent}%` },
                { key: 'progress', header: 'Actual %', render: (t) => `${t.progress}%` },
                { key: 'pv', header: 'PV', render: (t) => formatCurrency(t.pv) },
                { key: 'ev', header: 'EV', render: (t) => formatCurrency(t.ev) },
                { key: 'ac', header: 'AC', render: (t) => formatCurrency(t.ac) },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function PlannedCosts({ projectId, evm, costs, onChange }) {
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const byTask = Object.fromEntries(costs.map((c) => [c.task._id, c]));

  async function save(task) {
    const raw = drafts[task.taskRef];
    const value = Number(raw);
    if (raw === undefined || raw === '' || !Number.isFinite(value) || value < 0) {
      setError(new Error(`Planned cost for ${task.taskId} must be a number of zero or more`));
      return;
    }
    try {
      const existing = byTask[task.taskRef];
      if (existing) await api.activityCosts.update(existing._id, { plannedCost: value });
      else await api.activityCosts.create({ project: projectId, task: task.taskRef, plannedCost: value });
      setError(null);
      setMessage(`Planned cost for ${task.taskId} saved.`);
      setDrafts((dr) => ({ ...dr, [task.taskRef]: undefined }));
      onChange();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Card title="Planned Activity Costs">
      <SuccessAlert message={message} onClose={() => setMessage('')} />
      <ErrorAlert error={error} onClose={() => setError(null)} />
      <p className="mb-3 text-sm text-slate-600">
        Total planned: <strong>{formatCurrency(evm.totalPlannedCost)}</strong> vs approved budget <strong>{formatCurrency(evm.approvedBudget)}</strong>
        {evm.unestimatedTasks.length > 0 && <span className="ml-2 text-amber-700">Tasks without an estimate: {evm.unestimatedTasks.join(', ')}</span>}
      </p>
      <DataTable
        label="Planned costs"
        rowKey="taskId"
        rows={evm.breakdown}
        columns={[
          { key: 'taskId', header: 'Task', render: (t) => `${t.taskId} ${t.title}` },
          { key: 'schedule', header: 'Planned schedule', render: (t) => `${formatDate(t.plannedStartDate)} → ${formatDate(t.plannedEndDate)}` },
          { key: 'current', header: 'Planned cost', render: (t) => (byTask[t.taskRef] ? formatCurrency(t.plannedCost) : <span className="text-amber-700">Not estimated</span>) },
          {
            key: 'edit',
            header: 'New estimate (PKR)',
            render: (t) => (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  aria-label={`Planned cost for ${t.taskId}`}
                  className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                  value={drafts[t.taskRef] ?? ''}
                  placeholder={String(t.plannedCost)}
                  onChange={(e) => setDrafts((dr) => ({ ...dr, [t.taskRef]: e.target.value }))}
                />
                <Button size="sm" onClick={() => save(t)}>
                  Save
                </Button>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}

function Expenditures({ projectId, tasks, total, onChange }) {
  const list = useLoader(() => api.expenditures.list(projectId), [projectId]);
  const form = useForm(
    { task: '', amount: '', date: '', description: '' },
    {
      task: [rules.required('Related task')],
      amount: [rules.required('Amount'), rules.number('Amount', { positive: true })],
      date: [rules.required('Expenditure date'), rules.date('Expenditure date')],
    }
  );
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState(null);

  async function onAdd(e) {
    e.preventDefault();
    if (await form.submit((v) => api.expenditures.create({ ...v, project: projectId, amount: Number(v.amount) }))) {
      form.reset();
      list.reload();
      onChange();
    }
  }

  async function remove() {
    try {
      await api.expenditures.remove(toDelete._id);
      list.reload();
      onChange();
    } catch (err) {
      setError(err);
    }
    setToDelete(null);
  }

  return (
    <Card title="Actual Expenditure">
      <ErrorAlert error={error || list.error || form.apiError} />
      <form onSubmit={onAdd} className="mb-4 grid gap-3 md:grid-cols-5 md:items-end" noValidate>
        <Field label="Related task" name="task" as="select" value={form.values.task} onChange={form.onChange} error={form.errors.task}>
          <option value="">Select task…</option>
          {tasks.map((t) => (
            <option key={t.taskRef} value={t.taskRef}>
              {t.taskId} {t.title}
            </option>
          ))}
        </Field>
        <Field label="Amount (PKR)" name="amount" type="number" min="0" value={form.values.amount} onChange={form.onChange} error={form.errors.amount} />
        <Field label="Date" name="date" type="date" value={form.values.date} onChange={form.onChange} error={form.errors.date} />
        <Field label="Description" name="description" value={form.values.description} onChange={form.onChange} />
        <Button type="submit" disabled={form.submitting}>
          Record Expenditure
        </Button>
      </form>
      <DataTable
        label="Expenditures"
        rows={list.data || []}
        columns={[
          { key: 'date', header: 'Date', render: (e) => formatDate(e.date) },
          { key: 'task', header: 'Task', render: (e) => `${e.task.taskId} ${e.task.title}` },
          { key: 'description', header: 'Description' },
          { key: 'amount', header: 'Amount', render: (e) => formatCurrency(e.amount) },
          { key: 'x', header: '', render: (e) => <Button size="sm" variant="secondary" onClick={() => setToDelete(e)}>Delete</Button> },
        ]}
      />
      <p className="mt-2 text-right text-sm">
        Total actual expenditure: <strong>{formatCurrency(total)}</strong>
      </p>
      <ConfirmDialog open={!!toDelete} title="Delete expenditure" confirmLabel="Delete" variant="danger" onConfirm={remove} onCancel={() => setToDelete(null)}>
        {toDelete && `Delete the ${formatCurrency(toDelete.amount)} expenditure recorded on ${formatDate(toDelete.date)}?`}
      </ConfirmDialog>
    </Card>
  );
}
