const { api, projectPayload, createProject, day } = require('./helpers');
const { Project, ProjectPlan, Milestone, ProjectClosure } = require('../models');

describe('Module 1: Project initiation and integration', () => {
  test('TEST 1: project creation persists data in MongoDB', async () => {
    const res = await api.post('/api/projects').send(projectPayload({ name: 'Persisted Project', durationWeeks: 16, approvedBudget: 5000000 }));
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const stored = await Project.findById(res.body.data._id).lean();
    expect(stored.name).toBe('Persisted Project');
    expect(stored.approvedBudget).toBe(5000000);
    expect(stored.durationWeeks).toBe(16);
    expect(stored.status).toBe('Planned');
    // deadline = start + 16*7 - 1 days
    expect(day(stored.deadline)).toBe('2026-04-26');

    const fetched = await api.get(`/api/projects/${res.body.data._id}`);
    expect(fetched.body.data.name).toBe('Persisted Project');
  });

  test('TEST 2: negative project budget is rejected', async () => {
    const res = await api.post('/api/projects').send(projectPayload({ approvedBudget: -100 }));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'approvedBudget' })]));
    expect(await Project.countDocuments()).toBe(0);
  });

  test('rejects empty required fields and invalid dates / durations', async () => {
    const res = await api.post('/api/projects').send(projectPayload({ name: '', startDate: 'not-a-date', durationWeeks: 2.5 }));
    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'startDate']));
    expect(res.body.message).not.toMatch(/at .*\.js/); // no stack trace leakage
  });

  test('TEST 17: plan, milestones, status and closure records persist correctly', async () => {
    const project = await createProject();

    const plan = await api.post('/api/plans').send({ project: project._id, scopePlan: 'S', schedulePlan: 'Sch', costPlan: 'C', qualityPlan: 'Q' });
    expect(plan.status).toBe(201);
    const updatedPlan = await api.put(`/api/plans/${plan.body.data._id}`).send({ qualityPlan: 'Q2' });
    expect(updatedPlan.body.data.version).toBe(2);

    const ms = await api.post('/api/milestones').send({ project: project._id, title: 'Kick-off', plannedDate: '2026-01-05' });
    expect(ms.status).toBe(201);
    await api.put(`/api/milestones/${ms.body.data._id}`).send({ completionStatus: 'Completed', actualCompletionDate: '2026-01-06' });

    await api.put(`/api/projects/${project._id}`).send({ status: 'In Progress' });

    const closure = await api.post('/api/closures').send({
      project: project._id,
      closureDate: '2026-02-01',
      closureStatus: 'Final',
      closureNotes: 'All deliverables accepted',
      finalSummary: 'Delivered on budget',
    });
    expect(closure.status).toBe(201);

    expect((await ProjectPlan.findOne({ project: project._id })).qualityPlan).toBe('Q2');
    const storedMs = await Milestone.findById(ms.body.data._id);
    expect(storedMs.completionStatus).toBe('Completed');
    expect(day(storedMs.actualCompletionDate)).toBe('2026-01-06');
    expect((await ProjectClosure.findOne({ project: project._id })).closureNotes).toBe('All deliverables accepted');
    // A final closure formally closes the project.
    expect((await Project.findById(project._id)).status).toBe('Closed');
  });

  test('closure date before project start is rejected', async () => {
    const project = await createProject();
    const res = await api.post('/api/closures').send({
      project: project._id, closureDate: '2025-12-01', closureNotes: 'n', finalSummary: 's',
    });
    expect(res.status).toBe(400);
    expect(await ProjectClosure.countDocuments()).toBe(0);
  });

  test('unknown project id returns 404 and malformed id returns 400', async () => {
    expect((await api.get('/api/projects/64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
    expect((await api.get('/api/projects/not-an-id')).status).toBe(400);
  });
});
