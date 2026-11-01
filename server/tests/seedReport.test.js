const { api, createProject } = require('./helpers');
const { seedDatabase } = require('../seed/seedDatabase');
const m = require('../models');

async function countAll() {
  const out = {};
  for (const [name, Model] of Object.entries(m)) out[name] = await Model.countDocuments();
  return out;
}

describe('Seed data and integrated reporting', () => {
  test('TEST 20: seeding twice does not duplicate records or overwrite user data', async () => {
    const userProject = await createProject({ name: 'User project' });
    await seedDatabase();
    const first = await countAll();
    expect(first.Task).toBe(13);
    expect(first.TeamMember).toBe(7);
    expect(first.Requirement).toBe(7);

    // User edits demo data between seed runs.
    await m.Defect.updateOne({ title: 'Appointment Double Booking' }, { $set: { status: 'In Progress' } });

    const second = await seedDatabase();
    expect(await countAll()).toEqual(first);
    expect(Object.keys(second.created)).toHaveLength(0);
    expect((await m.Defect.findOne({ title: 'Appointment Double Booking' })).status).toBe('In Progress');
    expect(await m.Project.findById(userProject._id)).not.toBeNull();
  });

  test('seeded case study matches the examination baseline', async () => {
    const { projectId } = await seedDatabase();
    const project = await m.Project.findById(projectId);
    expect(project.approvedBudget).toBe(5000000);
    expect(project.durationWeeks).toBe(16);
    const costs = await m.ActivityCost.find({ project: projectId });
    expect(costs.reduce((s, c) => s + c.plannedCost, 0)).toBe(5000000);
    const sched = (await api.get(`/api/schedule/${projectId}`)).body.data;
    expect(new Date(sched.summary.plannedCompletion).getTime()).toBe(project.deadline.getTime());
    const approved = await m.Requirement.countDocuments({ project: projectId, approvalStatus: 'Approved' });
    expect(approved).toBe(5);
    const cr = await m.ChangeRequest.findOne({ project: projectId });
    expect(cr).toMatchObject({ title: 'AI Diagnosis and Mobile Application', costImpact: 800000, scheduleImpactWeeks: 3, status: 'Pending' });
  });

  test('project report contains progress, pending changes, delays, budget, EVM and critical defects', async () => {
    const { projectId } = await seedDatabase();
    const report = (await api.get(`/api/reports/${projectId}`)).body.data;
    expect(report.overallProgress).toBeGreaterThan(0);
    expect(report.pendingChangeRequests.map((c) => c.title)).toEqual(['AI Diagnosis and Mobile Application']);
    expect(report.delayedActivities.length).toBeGreaterThan(0);
    expect(report.budgetStatus).toMatchObject({ approvedBudget: 5000000, actualExpenditure: 3820000, remainingBudget: 1180000 });
    expect(report.evm).toEqual(expect.objectContaining({ ac: 3820000, ev: 3620000 }));
    expect(report.evm.cpi).toBeCloseTo(3620000 / 3820000, 4);
    expect(report.unresolvedCriticalDefects).toHaveLength(2);
  });

  test('unknown routes and malformed JSON return consistent error responses', async () => {
    const notFound = await api.get('/api/unknown');
    expect(notFound.status).toBe(404);
    expect(notFound.body).toMatchObject({ success: false });
    const bad = await api.post('/api/projects').set('Content-Type', 'application/json').send('{"name":');
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/not valid JSON/);
  });
});
