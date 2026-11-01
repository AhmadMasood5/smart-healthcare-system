import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import { useProject } from '../context/ProjectContext';
import { useLoader } from '../utils/useLoader';
import { formatCurrency, formatDate, formatIndex, formatNumber } from '../utils/formatters';
import { Button, Card, ErrorAlert, Loading, NoProject, PageHeader, ProgressBar, StatCard, WarningList } from '../components/ui';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';

const indexTone = (v) => (v === null ? 'default' : v < 1 ? 'bad' : 'good');
const compactPkr = (v) => `${(v / 1000000).toFixed(2)}M`;

function SingleSeriesBars({ data, valueFormatter, height = 220, label }) {
  return (
    <div style={{ height }} aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#334155' }} />
          <YAxis tickFormatter={valueFormatter} tick={{ fontSize: 11, fill: '#64748b' }} width={55} />
          <Tooltip formatter={(v) => valueFormatter(v)} cursor={{ fill: 'rgba(148,163,184,0.15)' }} />
          <Bar dataKey="value" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            <LabelList dataKey="value" position="top" formatter={valueFormatter} style={{ fontSize: 11, fill: '#334155' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const { projectId } = useProject();
  const { data, error, loading } = useLoader(() => (projectId ? api.dashboard(projectId) : Promise.resolve(null)), [projectId]);
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState(null);

  if (!projectId) return <NoProject />;
  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;
  if (!data) return null;

  const { project, tasks, changeRequests, financial, quality, risks, warnings } = data;

  async function generateReport() {
    try {
      setReport(await api.report(projectId));
      setReportError(null);
    } catch (err) {
      setReportError(err);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Project Dashboard" subtitle={`Live status as of ${formatDate(data.reportDate)} — every value is calculated by the backend from MongoDB records.`} />

      <Card title="Project Overview">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900" data-testid="dash-project-name">
            {project.name}
          </h2>
          <StatusBadge value={project.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Approved Budget" value={formatCurrency(project.approvedBudget)} testId="dash-budget" />
          <StatCard label="Approved Duration" value={`${project.durationWeeks} weeks`} testId="dash-duration" />
          <StatCard label="Deadline" value={formatDate(project.deadline)} />
          <StatCard label="Overall Progress" value={`${project.overallProgress}%`} hint="Earned value ÷ total planned cost" testId="dash-progress" />
        </div>
        <div className="mt-4">
          <ProgressBar value={project.overallProgress} />
        </div>
      </Card>

      <Card title="Warnings">
        <WarningList warnings={warnings} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Task Statistics">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="Total Tasks" value={tasks.totalTasks} testId="dash-total-tasks" />
            <StatCard label="Completed" value={tasks.completedTasks} tone="good" />
            <StatCard label="Delayed" value={tasks.delayedTasks} tone={tasks.delayedTasks ? 'bad' : 'good'} testId="dash-delayed" />
          </div>
          <SingleSeriesBars
            label="Tasks by status"
            valueFormatter={(v) => formatNumber(v)}
            data={[
              { name: 'Completed', value: tasks.completedTasks },
              { name: 'In Progress', value: tasks.inProgressTasks },
              { name: 'Not Started', value: tasks.notStartedTasks },
              { name: 'Delayed', value: tasks.delayedTasks },
            ]}
          />
          <p className="mt-2 text-xs text-slate-500">
            Planned completion {formatDate(tasks.plannedCompletion)} · Forecast {formatDate(tasks.forecastCompletion)} (
            {tasks.forecastVsDeadlineDays > 0 ? `${tasks.forecastVsDeadlineDays} days late` : `${-tasks.forecastVsDeadlineDays} days inside deadline`})
          </p>
        </Card>

        <Card title="Financial Performance (EVM)">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="CPI" value={formatIndex(financial.cpi)} hint={financial.cpiStatus} tone={indexTone(financial.cpi)} testId="dash-cpi" />
            <StatCard label="SPI" value={formatIndex(financial.spi)} hint={financial.spiStatus} tone={indexTone(financial.spi)} testId="dash-spi" />
            <StatCard label="Remaining Budget" value={formatCurrency(financial.remainingBudget)} tone={financial.remainingBudget < 0 ? 'bad' : 'default'} />
          </div>
          <SingleSeriesBars
            label="Earned value measures"
            valueFormatter={compactPkr}
            data={[
              { name: 'Planned Value', value: financial.pv },
              { name: 'Earned Value', value: financial.ev },
              { name: 'Actual Cost', value: financial.ac },
            ]}
          />
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
            <span data-testid="dash-pv">PV: {formatCurrency(financial.pv)}</span>
            <span data-testid="dash-ev">EV: {formatCurrency(financial.ev)}</span>
            <span data-testid="dash-ac">AC: {formatCurrency(financial.ac)}</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Change Requests">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Pending" value={changeRequests.pending} tone={changeRequests.pending ? 'warn' : 'default'} testId="dash-cr-pending" />
            <StatCard label="Approved" value={changeRequests.approved} tone="good" testId="dash-cr-approved" />
            <StatCard label="Rejected" value={changeRequests.rejected} />
          </div>
        </Card>
        <Card title="Quality">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Defects" value={quality.total} />
            <StatCard label="Unresolved" value={quality.unresolved} tone={quality.unresolved ? 'warn' : 'good'} />
            <StatCard label="Critical Open" value={quality.unresolvedCritical} tone={quality.unresolvedCritical ? 'bad' : 'good'} testId="dash-critical" />
          </div>
        </Card>
        <Card title="High-Priority Risks">
          {risks.highPriority.length ? (
            <ul className="space-y-2 text-sm">
              {risks.highPriority.map((r) => (
                <li key={r._id} className="flex items-center justify-between">
                  <span>
                    {r.riskId} {r.title}
                  </span>
                  <span className="font-semibold text-red-700">Score {r.score}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No high-priority risks.</p>
          )}
        </Card>
      </div>

      <Card title="Integrated Project Status Report" actions={<Button onClick={generateReport}>Generate Report</Button>}>
        <ErrorAlert error={reportError} />
        {report ? <ProjectReport report={report} /> : <p className="text-sm text-slate-500">Generate a status report from the current database values.</p>}
      </Card>
    </div>
  );
}

function ProjectReport({ report }) {
  return (
    <div className="space-y-5 text-sm" data-testid="project-report">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{report.project.name}</div>
          <div className="text-xs text-slate-500">Generated {new Date(report.generatedAt).toLocaleString()}</div>
        </div>
        <Button variant="secondary" className="no-print" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Overall Progress" value={`${report.overallProgress}%`} />
        <StatCard label="Delayed Activities" value={report.delayedActivities.length} />
        <StatCard label="Pending Changes" value={report.pendingChangeRequests.length} />
        <StatCard label="Critical Defects Open" value={report.unresolvedCriticalDefects.length} />
      </div>
      <section>
        <h3 className="mb-2 font-semibold">Budget Status</h3>
        <p>
          Approved {formatCurrency(report.budgetStatus.approvedBudget)} · Planned {formatCurrency(report.budgetStatus.totalPlannedCost)} · Spent{' '}
          {formatCurrency(report.budgetStatus.actualExpenditure)} · Remaining {formatCurrency(report.budgetStatus.remainingBudget)}
          {report.budgetStatus.overBudget && <strong className="ml-2 text-red-700">OVER BUDGET</strong>}
        </p>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">EVM Results</h3>
        <p>
          PV {formatCurrency(report.evm.pv)} · EV {formatCurrency(report.evm.ev)} · AC {formatCurrency(report.evm.ac)} · CPI {formatIndex(report.evm.cpi)} (
          {report.evm.cpiStatus}) · SPI {formatIndex(report.evm.spi)} ({report.evm.spiStatus})
        </p>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Schedule</h3>
        <p>
          Planned completion {formatDate(report.schedule.plannedCompletion)}, forecast {formatDate(report.schedule.forecastCompletion)}, approved deadline{' '}
          {formatDate(report.schedule.approvedDeadline)}.
        </p>
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Delayed Activities</h3>
        <DataTable
          rowKey="taskId"
          rows={report.delayedActivities}
          emptyMessage="No delayed activities."
          columns={[
            { key: 'taskId', header: 'Task' },
            { key: 'title', header: 'Title' },
            { key: 'delayDays', header: 'Delay (days)' },
            { key: 'delayCause', header: 'Cause' },
            { key: 'completionImpactDays', header: 'Impact on completion (days)' },
          ]}
        />
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Pending Change Requests</h3>
        <DataTable
          rows={report.pendingChangeRequests}
          emptyMessage="No pending change requests."
          columns={[
            { key: 'changeId', header: 'ID' },
            { key: 'title', header: 'Title' },
            { key: 'costImpact', header: 'Cost impact', render: (r) => formatCurrency(r.costImpact) },
            { key: 'scheduleImpactWeeks', header: 'Schedule impact', render: (r) => `${r.scheduleImpactWeeks} weeks` },
          ]}
        />
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Unresolved Critical Defects</h3>
        <DataTable
          rows={report.unresolvedCriticalDefects}
          emptyMessage="No unresolved critical defects."
          columns={[
            { key: 'defectId', header: 'ID' },
            { key: 'title', header: 'Title' },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          ]}
        />
      </section>
    </div>
  );
}
