import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProjectProvider } from '../context/ProjectContext';
import Dashboard from '../pages/Dashboard';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: { projects: { list: vi.fn() }, dashboard: vi.fn(), report: vi.fn() },
}));

const PROJECT = { _id: 'p1', name: 'Smart Healthcare Software Development Project', status: 'In Progress', approvedBudget: 5800000, durationWeeks: 19, deadline: '2026-12-13T00:00:00.000Z' };

const DASHBOARD = {
  reportDate: '2026-10-25T00:00:00.000Z',
  project: { ...PROJECT, projectManager: 'Ayesha Khan', startDate: '2026-08-03T00:00:00.000Z', overallProgress: 62.4 },
  tasks: {
    totalTasks: 15, completedTasks: 8, inProgressTasks: 2, notStartedTasks: 5, delayedTasks: 7, assignedMembers: 7,
    plannedCompletion: '2026-12-13T00:00:00.000Z', forecastCompletion: '2027-01-01T00:00:00.000Z', approvedDeadline: '2026-12-13T00:00:00.000Z', forecastVsDeadlineDays: 19,
  },
  changeRequests: { pending: 0, approved: 1, rejected: 0, pendingList: [] },
  scope: { approvedRequirements: 7, pendingRequirements: 0 },
  financial: {
    approvedBudget: 5800000, totalPlannedCost: 5800000, actualExpenditure: 3820000, remainingBudget: 1980000,
    pv: 4338095.24, ev: 3620000, ac: 3820000, cpi: 0.9476, spi: 0.8345, cpiStatus: 'Poor cost performance (over budget)', spiStatus: 'Behind schedule',
  },
  quality: { total: 3, unresolved: 2, resolved: 1, unresolvedCritical: 2, unresolvedCriticalDefects: [] },
  risks: { total: 4, highPriority: [{ _id: 'r1', riskId: 'RSK-004', title: 'Critical Software Defects', score: 20 }] },
  delayedActivities: [],
  warnings: [
    { type: 'COST_PERFORMANCE', severity: 'warning', message: 'Cost performance warning: CPI is 0.95 (below 1).' },
    { type: 'CRITICAL_DEFECTS', severity: 'critical', message: '2 critical defect(s) unresolved: Appointment Double Booking, Patient Record Management Failure.' },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProjectProvider>
        <Dashboard />
      </ProjectProvider>
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.projects.list.mockResolvedValue([PROJECT]);
    api.dashboard.mockResolvedValue(DASHBOARD);
  });

  test('TEST 23: displays values derived from the dashboard API', async () => {
    renderDashboard();
    expect(await screen.findByTestId('dash-project-name')).toHaveTextContent('Smart Healthcare Software Development Project');
    expect(api.dashboard).toHaveBeenCalledWith('p1');
    expect(screen.getByTestId('dash-budget')).toHaveTextContent('PKR 5,800,000');
    expect(screen.getByTestId('dash-duration')).toHaveTextContent('19 weeks');
    expect(screen.getByTestId('dash-progress')).toHaveTextContent('62.4%');
    expect(screen.getByTestId('dash-total-tasks')).toHaveTextContent('15');
    expect(screen.getByTestId('dash-delayed')).toHaveTextContent('7');
    expect(screen.getByTestId('dash-cpi')).toHaveTextContent('0.9476');
    expect(screen.getByTestId('dash-spi')).toHaveTextContent('0.8345');
    expect(screen.getByTestId('dash-pv')).toHaveTextContent('PKR 4,338,095');
    expect(screen.getByTestId('dash-ev')).toHaveTextContent('PKR 3,620,000');
    expect(screen.getByTestId('dash-ac')).toHaveTextContent('PKR 3,820,000');
    expect(screen.getByTestId('dash-cr-approved')).toHaveTextContent('1');
    expect(screen.getByTestId('dash-critical')).toHaveTextContent('2');
    const warnings = screen.getByRole('list', { name: 'Warnings' });
    expect(within(warnings).getByText(/Appointment Double Booking/)).toBeInTheDocument();
    expect(screen.getByText('RSK-004 Critical Software Defects')).toBeInTheDocument();
  });

  test('generates the integrated project report from the API', async () => {
    const user = userEvent.setup();
    api.report.mockResolvedValue({
      generatedAt: '2026-10-25T10:00:00.000Z',
      project: PROJECT,
      overallProgress: 62.4,
      schedule: { plannedCompletion: DASHBOARD.tasks.plannedCompletion, forecastCompletion: DASHBOARD.tasks.forecastCompletion, approvedDeadline: DASHBOARD.tasks.approvedDeadline },
      pendingChangeRequests: [],
      delayedActivities: [{ taskId: 'T-008', title: 'Doctor Scheduling Module', delayDays: 19, delayCause: 'Progress behind plan', completionImpactDays: 17 }],
      budgetStatus: { approvedBudget: 5800000, totalPlannedCost: 5800000, actualExpenditure: 3820000, remainingBudget: 1980000, overBudget: false },
      evm: DASHBOARD.financial,
      unresolvedCriticalDefects: [{ _id: 'd1', defectId: 'DEF-001', title: 'Appointment Double Booking', status: 'Open' }],
    });
    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Generate Report' }));
    const report = await screen.findByTestId('project-report');
    expect(within(report).getByText('Doctor Scheduling Module')).toBeInTheDocument();
    expect(within(report).getByText('Appointment Double Booking')).toBeInTheDocument();
  });

  test('shows an understandable error when the API fails', async () => {
    const err = new Error('Cannot reach the API server. Make sure the backend is running.');
    api.dashboard.mockRejectedValue(err);
    renderDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the API server');
  });
});
