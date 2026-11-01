const { api, createProject, createTask, seedCaseStudy } = require('./helpers');
const { calculateRiskScore } = require('../models/Risk');
const m = require('../models');

describe('Module 5: Quality management and risk control', () => {
  test('TEST 14: risk score = likelihood x impact (4 x 5 = 20), never taken from input', async () => {
    expect(calculateRiskScore(4, 5)).toBe(20);

    const project = await createProject();
    const res = await api.post('/api/risks').send({
      project: project._id, title: 'Critical Software Defects', description: 'd', likelihood: 4, impact: 5, score: 1, priority: 'Low',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.score).toBe(20);
    expect(res.body.data.priority).toBe('High');

    const upd = await api.put(`/api/risks/${res.body.data._id}`).send({ likelihood: 2 });
    expect(upd.body.data.score).toBe(10);
    expect(upd.body.data.priority).toBe('Medium');
    expect((await api.post('/api/risks').send({ project: project._id, title: 'x', description: 'd', likelihood: 6, impact: 1 })).status).toBe(400);
  });

  test('risks are ranked and placed on the 5x5 matrix; PDPC is built from stored responses', async () => {
    const { projectId } = await seedCaseStudy();
    const ranked = (await api.get('/api/risks').query({ projectId })).body.data;
    expect(ranked.map((r) => [r.title, r.score])).toEqual([
      ['Critical Software Defects', 20],
      ['Schedule Delay', 16],
      ['Budget Overrun', 12],
      ['Database Failure', 10],
    ]);
    const matrix = (await api.get(`/api/risks/matrix/${projectId}`)).body.data;
    expect(matrix.cells).toHaveLength(25);
    expect(matrix.cells.find((c) => c.likelihood === 4 && c.impact === 5).risks[0].title).toBe('Critical Software Defects');

    const pdpc = (await api.get(`/api/risk-responses/pdpc/${projectId}`)).body.data;
    const db = pdpc.risks.find((r) => r.title === 'Database Failure');
    expect(db.problems[0]).toMatchObject({
      potentialProblem: 'Database Failure',
      preventiveAction: 'Regular database backups.',
      correctiveAction: 'Restore the latest valid backup.',
    });
  });

  test('TEST 15: critical defects appear in dashboard statistics', async () => {
    const { projectId } = await seedCaseStudy();
    const dash = (await api.get(`/api/dashboard/${projectId}`)).body.data;
    expect(dash.quality.unresolvedCritical).toBe(2);
    expect(dash.quality.unresolvedCriticalDefects.map((d) => d.title)).toEqual(
      expect.arrayContaining(['Appointment Double Booking', 'Patient Record Management Failure'])
    );
    expect(dash.warnings.map((w) => w.type)).toContain('CRITICAL_DEFECTS');
  });

  test('TEST 16: resolving a critical defect updates the statistics', async () => {
    const { projectId } = await seedCaseStudy();
    const def = await m.Defect.findOne({ project: projectId, title: 'Appointment Double Booking' });
    const res = await api.put(`/api/defects/${def._id}`).send({ status: 'Resolved' });
    expect(res.status).toBe(200);

    const stats = (await api.get(`/api/defects/stats/${projectId}`)).body.data;
    expect(stats.unresolvedCritical).toBe(1);
    const dash = (await api.get(`/api/dashboard/${projectId}`)).body.data;
    expect(dash.quality.unresolvedCritical).toBe(1);
    expect(dash.quality.unresolvedCriticalDefects.map((d) => d.title)).toEqual(['Patient Record Management Failure']);
  });

  test('defects must reference tasks, deliverables and members of the same project', async () => {
    const project = await createProject();
    const other = await createProject({ name: 'Other' });
    const foreignTask = await createTask(other._id, 'Foreign', 2);
    const res = await api.post('/api/defects').send({
      project: project._id, title: 'Bug', description: 'd', severity: 'High', relatedTask: foreignTask._id,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/different project/);

    const own = await createTask(project._id, 'Own', 2);
    const noRelation = await api.post('/api/defects').send({ project: project._id, title: 'Bug', description: 'd', severity: 'High' });
    expect(noRelation.status).toBe(400);
    const ok = await api.post('/api/defects').send({ project: project._id, title: 'Bug', description: 'd', severity: 'Severe', relatedTask: own._id });
    expect(ok.status).toBe(400); // invalid severity
  });

  test('quality checklist results are recorded and validated', async () => {
    const project = await createProject();
    const item = (await api.post('/api/quality-checklists').send({ project: project._id, deliverable: 'Appointment Module', item: 'Double booking is prevented' })).body.data;
    expect(item.inspectionResult).toBe('Not Inspected');
    expect((await api.put(`/api/quality-checklists/${item._id}`).send({ status: 'Completed' })).status).toBe(400);
    const upd = await api.put(`/api/quality-checklists/${item._id}`).send({ status: 'Completed', inspectionResult: 'Fail', remarks: 'DEF-001' });
    expect(upd.body.data.inspectionResult).toBe('Fail');
    expect((await m.QualityChecklist.findById(item._id)).remarks).toBe('DEF-001');
  });
});
