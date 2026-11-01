const { api, createProject } = require('./helpers');
const { WBSItem } = require('../models');

async function addRequirement(projectId, title) {
  const res = await api.post('/api/requirements').send({ project: projectId, title, description: `${title} description`, priority: 'High' });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Module 2: Scope management and WBS', () => {
  test('TEST 3: pending requirements are excluded from approved scope', async () => {
    const project = await createProject();
    const req = await addRequirement(project._id, 'Patient Appointment Management');
    expect(req.approvalStatus).toBe('Pending');

    const scope = await api.get(`/api/requirements/scope/${project._id}`);
    expect(scope.body.data.approved).toHaveLength(0);
    expect(scope.body.data.excluded.pending.map((r) => r.title)).toContain('Patient Appointment Management');

    // Backend refuses to put a pending requirement into the WBS (approved scope).
    const wbs = await api.post('/api/wbs').send({ project: project._id, title: 'Appointment Module', type: 'Work Package', requirement: req._id });
    expect(wbs.status).toBe(400);
    expect(wbs.body.message).toMatch(/Only approved requirements/);
  });

  test('TEST 4: approved requirements enter approved scope; rejected stay excluded', async () => {
    const project = await createProject();
    const a = await addRequirement(project._id, 'Laboratory Reports');
    const b = await addRequirement(project._id, 'Hospital Billing');

    expect((await api.post(`/api/requirements/${a._id}/approve`)).status).toBe(200);
    expect((await api.post(`/api/requirements/${b._id}/reject`)).status).toBe(200);

    const scope = (await api.get(`/api/requirements/scope/${project._id}`)).body.data;
    expect(scope.approved.map((r) => r.title)).toEqual(['Laboratory Reports']);
    expect(scope.excluded.rejected.map((r) => r.title)).toEqual(['Hospital Billing']);

    const wbs = await api.post('/api/wbs').send({ project: project._id, title: 'Laboratory Module', type: 'Work Package', requirement: a._id });
    expect(wbs.status).toBe(201);
  });

  test('requirement prioritisation updates priority and validates value', async () => {
    const project = await createProject();
    const req = await addRequirement(project._id, 'Doctor Scheduling');
    const ok = await api.patch(`/api/requirements/${req._id}/priority`).send({ priority: 'Critical' });
    expect(ok.body.data.priority).toBe('Critical');
    const bad = await api.patch(`/api/requirements/${req._id}/priority`).send({ priority: 'Urgent' });
    expect(bad.status).toBe(400);
  });

  test('WBS hierarchy is built and circular parent relationships are rejected', async () => {
    const project = await createProject();
    const root = (await api.post('/api/wbs').send({ project: project._id, title: 'Root', type: 'Deliverable' })).body.data;
    const dev = (await api.post('/api/wbs').send({ project: project._id, title: 'Development', type: 'Deliverable', parent: root._id })).body.data;
    const sub = (await api.post('/api/wbs').send({ project: project._id, title: 'Modules', type: 'Sub-deliverable', parent: dev._id })).body.data;
    const wp = (await api.post('/api/wbs').send({ project: project._id, title: 'Billing', type: 'Work Package', parent: sub._id })).body.data;

    const tree = (await api.get(`/api/wbs/tree/${project._id}`)).body.data;
    expect(tree[0].title).toBe('Root');
    expect(tree[0].children[0].children[0].children[0]).toMatchObject({ title: 'Billing', code: '1.1.1.1' });

    const cycle = await api.put(`/api/wbs/${dev._id}`).send({ parent: sub._id });
    expect(cycle.status).toBe(400);
    expect(cycle.body.message).toMatch(/Circular/);
    expect((await api.put(`/api/wbs/${dev._id}`).send({ parent: dev._id })).status).toBe(400);
    expect((await api.post('/api/wbs').send({ project: project._id, title: 'Under WP', type: 'Work Package', parent: wp._id })).status).toBe(400);

    const other = await createProject({ name: 'Other' });
    const foreign = await api.post('/api/wbs').send({ project: other._id, title: 'Foreign child', type: 'Work Package', parent: root._id });
    expect(foreign.status).toBe(400);
    expect((await WBSItem.findById(dev._id)).parent.toString()).toBe(root._id);
  });
});
