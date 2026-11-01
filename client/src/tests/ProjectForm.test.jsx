import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProjectProvider } from '../context/ProjectContext';
import ProjectManagement from '../pages/ProjectManagement';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: { projects: { list: vi.fn(), create: vi.fn(), update: vi.fn() } },
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ProjectProvider>
        <ProjectManagement />
      </ProjectProvider>
    </MemoryRouter>
  );
}

async function fillCharter(user, overrides = {}) {
  const values = {
    'Project name': 'Smart Healthcare Software Development Project',
    Description: 'Healthcare software for five hospitals',
    'Objectives (one per line)': 'Deliver five modules{enter}Stay within budget',
    'Scope boundaries': 'Five healthcare modules only',
    'Approved budget (PKR)': '5000000',
    'Project manager': 'Ayesha Khan',
    'Start date': '2026-08-03',
    'Duration (weeks)': '16',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (value) await user.type(input, value);
  }
}

describe('Project charter form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.projects.list.mockResolvedValue([]);
  });

  test('TEST 21: submits valid charter data to the API with correct types', async () => {
    const user = userEvent.setup();
    api.projects.create.mockResolvedValue({ _id: 'p1', name: 'Smart Healthcare Software Development Project' });
    renderPage();

    await screen.findByText('Create Project Charter');
    await fillCharter(user);
    expect(screen.getByTestId('deadline-preview')).toHaveTextContent('22 Nov 2026');
    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => expect(api.projects.create).toHaveBeenCalledTimes(1));
    expect(api.projects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Smart Healthcare Software Development Project',
        objectives: ['Deliver five modules', 'Stay within budget'],
        approvedBudget: 5000000,
        durationWeeks: 16,
        startDate: '2026-08-03',
        projectManager: 'Ayesha Khan',
        status: 'Planned',
      })
    );
    await waitFor(() => expect(api.projects.list).toHaveBeenCalledTimes(2)); // project list refreshed
  });

  test('client validation blocks negative budgets and empty required fields', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Create Project Charter');
    await fillCharter(user, { 'Approved budget (PKR)': '-5', 'Project manager': '' });
    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    expect(await screen.findByText('Approved budget must be greater than zero')).toBeInTheDocument();
    expect(screen.getByText('Project manager is required')).toBeInTheDocument();
    expect(api.projects.create).not.toHaveBeenCalled();
  });

  test('TEST 22: displays backend validation errors', async () => {
    const user = userEvent.setup();
    const err = new Error('Duration must be a whole number of weeks; Start date must be a valid date');
    err.fieldErrors = [
      { field: 'durationWeeks', message: 'Duration must be a whole number of weeks' },
      { field: 'startDate', message: 'Start date must be a valid date' },
    ];
    api.projects.create.mockRejectedValue(err);
    renderPage();

    await screen.findByText('Create Project Charter');
    await fillCharter(user);
    await user.click(screen.getByRole('button', { name: 'Create Project' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Duration must be a whole number of weeks; Start date must be a valid date');
    expect(screen.getByText('Start date must be a valid date', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Duration must be a whole number of weeks', { selector: 'p' })).toBeInTheDocument();
  });
});
