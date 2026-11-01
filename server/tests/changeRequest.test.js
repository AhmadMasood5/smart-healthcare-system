const { api, seedCaseStudy, createProject, day } = require('./helpers');
const scheduleService = require('../services/scheduleService');
const m = require('../models');
const { addDays } = require('../utils/dates');

async function baseline(projectId) {
  const p = await m.Project.findById(projectId).lean();
  return { budget: p.approvedBudget, weeks: p.durationWeeks, deadline: day(p.deadline), start: p.startDate };
}

describe('Change request management and integrated impact', () => {
  test('TEST 5 & 6: approval updates budget 5,000,000 -> 5,800,000 and duration 16 -> 19 weeks', async () => {
    const { projectId, crId } = await seedCaseStudy();
    const before = await baseline(projectId);
    expect(before.budget).toBe(5000000);
    expect(before.weeks).toBe(16);

    const res = await api.post(`/api/change-requests/${crId}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Approved');

    const after = await baseline(projectId);
    expect(after.budget).toBe(5800000);
    expect(after.weeks).toBe(19);
    expect(after.deadline).toBe(day(addDays(before.start, 19 * 7 - 1)));
  });

  test('TEST 7: rejected change does not modify the approved baseline', async () => {
    const { projectId, crId } = await seedCaseStudy();
    const before = await baseline(projectId);
    const tasksBefore = await m.Task.countDocuments({ project: projectId });

    const res = await api.post(`/api/change-requests/${crId}/reject`).send({ notes: 'Not funded this phase' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Rejected');

    expect(await baseline(projectId)).toEqual(before);
    expect(await m.Task.countDocuments({ project: projectId })).toBe(tasksBefore);
    const reqs = await m.Requirement.find({ project: projectId, reqId: { $in: ['REQ-006', 'REQ-007'] } });
    expect(reqs.every((r) => r.approvalStatus === 'Rejected')).toBe(true);
    const scope = (await api.get(`/api/requirements/scope/${projectId}`)).body.data;
    expect(scope.approved.map((r) => r.reqId)).not.toContain('REQ-006');

    // A rejected request cannot later be approved.
    expect((await api.post(`/api/change-requests/${crId}/approve`)).status).toBe(409);
    expect(await baseline(projectId)).toEqual(before);
  });

  test('TEST 8: duplicate approval does not apply the impact twice', async () => {
    const { projectId, crId } = await seedCaseStudy();
    expect((await api.post(`/api/change-requests/${crId}/approve`)).status).toBe(200);
    const second = await api.post(`/api/change-requests/${crId}/approve`);
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already been approved/);

    const after = await baseline(projectId);
    expect(after.budget).toBe(5800000);
    expect(after.weeks).toBe(19);
    expect(await m.Task.countDocuments({ project: projectId, changeRequest: crId })).toBe(2);
    const costs = await m.ActivityCost.find({ project: projectId });
    expect(costs.reduce((s, c) => s + c.plannedCost, 0)).toBe(5800000);
  });

  test('concurrent approvals apply the impact exactly once', async () => {
    const { projectId, crId } = await seedCaseStudy();
    const results = await Promise.all([1, 2, 3].map(() => api.post(`/api/change-requests/${crId}/approve`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await baseline(projectId)).budget).toBe(5800000);
  });

  test('TEST 18: approval updates scope, WBS, schedule, costs, plan and dashboard together', async () => {
    const { projectId, crId } = await seedCaseStudy();
    await api.post(`/api/change-requests/${crId}/approve`).expect(200);

    // Requirements & approved scope
    const scope = (await api.get(`/api/requirements/scope/${projectId}`)).body.data;
    expect(scope.approved.map((r) => r.title)).toEqual(
      expect.arrayContaining(['AI-Based Preliminary Diagnosis Module', 'Mobile Application'])
    );
    expect(scope.counts).toEqual({ approved: 7, pending: 0, rejected: 0 });

    // WBS work packages under Healthcare Modules, linked to the new requirements
    const parent = await m.WBSItem.findOne({ project: projectId, title: 'Healthcare Modules' });
    const newWbs = await m.WBSItem.find({ project: projectId, parent: parent._id, requirement: { $ne: null } }).populate('requirement');
    expect(newWbs.map((w) => w.requirement.reqId)).toEqual(expect.arrayContaining(['REQ-006', 'REQ-007']));

    // Schedule: new tasks sit between Integration (T-011) and Testing (T-012)
    const schedule = (await api.get(`/api/schedule/${projectId}`)).body.data;
    const byId = Object.fromEntries(schedule.tasks.map((t) => [t.taskId, t]));
    const ai = schedule.tasks.find((t) => t.title === 'AI Diagnosis Module Development');
    expect(ai.predecessorTaskIds).toContain('T-011');
    expect(day(ai.plannedStart)).toBe(day(addDays(byId['T-011'].plannedEnd, 1)));
    expect(new Date(byId['T-012'].plannedStart) > new Date(ai.plannedEnd)).toBe(true);
    const project = await m.Project.findById(projectId);
    expect(day(schedule.summary.plannedCompletion)).toBe(day(project.deadline));

    // Task-linked milestone follows the new schedule
    const golive = await m.Milestone.findOne({ project: projectId, title: 'Go-Live (Final Deployment)' });
    expect(day(golive.plannedDate)).toBe(day(project.deadline));

    // Project plan reflects the new baseline
    const plan = await m.ProjectPlan.findOne({ project: projectId });
    expect(plan.baselineBudget).toBe(5800000);
    expect(plan.baselineDurationWeeks).toBe(19);
    expect(plan.revisions[plan.revisions.length - 1].description).toMatch(/CR-001 approved/);

    // Costs and dashboard
    const evm = (await api.get(`/api/evm/${projectId}`)).body.data;
    expect(evm.approvedBudget).toBe(5800000);
    expect(evm.totalPlannedCost).toBe(5800000);
    const dash = (await api.get(`/api/dashboard/${projectId}`)).body.data;
    expect(dash.project.approvedBudget).toBe(5800000);
    expect(dash.project.durationWeeks).toBe(19);
    expect(dash.changeRequests).toMatchObject({ pending: 0, approved: 1, rejected: 0 });
  });

  test('TEST 19: a failure during approval rolls back every partial update', async () => {
    const { projectId, crId } = await seedCaseStudy();
    const before = await baseline(projectId);
    const counts = async () => ({
      tasks: await m.Task.countDocuments({ project: projectId }),
      wbs: await m.WBSItem.countDocuments({ project: projectId }),
      costs: await m.ActivityCost.countDocuments({ project: projectId }),
      deps: await m.TaskDependency.countDocuments({ project: projectId }),
    });
    const countsBefore = await counts();

    // Fail at the final step, after requirements, budget, WBS, tasks and costs were written.
    jest.spyOn(scheduleService, 'recalculateProjectSchedule').mockRejectedValueOnce(new Error('Simulated database failure'));
    const res = await api.post(`/api/change-requests/${crId}/approve`);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('An unexpected server error occurred');

    expect(await baseline(projectId)).toEqual(before);
    expect(await counts()).toEqual(countsBefore);
    expect((await m.ChangeRequest.findById(crId)).status).toBe('Pending');
    const reqs = await m.Requirement.find({ project: projectId, reqId: { $in: ['REQ-006', 'REQ-007'] } });
    expect(reqs.every((r) => r.approvalStatus === 'Pending')).toBe(true);
    expect((await m.ProjectPlan.findOne({ project: projectId })).version).toBe(1);

    // The request is still approvable once the fault is gone.
    jest.restoreAllMocks();
    expect((await api.post(`/api/change-requests/${crId}/approve`)).status).toBe(200);
    expect((await baseline(projectId)).budget).toBe(5800000);
  });

  test('change request cannot approve requirements belonging to another project', async () => {
    const { crId } = await seedCaseStudy();
    const other = await createProject({ name: 'Other project' });
    const foreign = await api.post('/api/requirements').send({ project: other._id, title: 'Foreign', description: 'x' });
    await m.ChangeRequest.updateOne({ _id: crId }, { $push: { proposedRequirements: foreign.body.data._id } });

    const res = await api.post(`/api/change-requests/${crId}/approve`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/different project/);
    expect((await m.ChangeRequest.findById(crId)).status).toBe('Pending');
    expect((await m.Requirement.findById(foreign.body.data._id)).approvalStatus).toBe('Pending');
  });

  test('creating a change request validates input and creates pending requirements', async () => {
    const { projectId } = await seedCaseStudy();
    const bad = await api.post('/api/change-requests').send({
      project: projectId, title: 'Bad', description: 'd', justification: 'j', costImpact: -1, scheduleImpactWeeks: 1,
      proposedItems: [{ title: 'X', description: 'x' }],
    });
    expect(bad.status).toBe(400);

    const ok = await api.post('/api/change-requests').send({
      project: projectId, title: 'Reporting', description: 'd', justification: 'j', costImpact: 100000, scheduleImpactWeeks: 1,
      proposedItems: [{ title: 'Management Reports', description: 'Monthly reports', estimatedDuration: 7, plannedCost: 100000 }],
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.changeId).toBe('CR-002');
    expect(ok.body.data.proposedRequirements[0].approvalStatus).toBe('Pending');
    // Requirements raised by a change request cannot bypass it.
    expect((await api.post(`/api/requirements/${ok.body.data.proposedRequirements[0]._id}/approve`)).status).toBe(409);
  });
});
