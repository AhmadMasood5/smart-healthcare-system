const { ChangeRequest, Requirement, Task, TaskDependency, TeamMember, WBSItem, ActivityCost } = require('../models');
const AppError = require('../utils/AppError');
const { pick } = require('../utils/http');
const { withTransaction } = require('../utils/transaction');
const { requireProject, assertSameProject, findOr404, nextCode } = require('./referenceService');
const requirementService = require('./requirementService');
const wbsService = require('./wbsService');
const taskService = require('./taskService');
const projectService = require('./projectService');
const scheduleService = require('./scheduleService');

const FIELDS = ['title', 'description', 'justification', 'costImpact', 'scheduleImpactWeeks', 'wbsParent'];

function populateCr(query) {
  return query
    .populate('proposedRequirements', 'reqId title approvalStatus priority')
    .populate('proposedWork.assignedTo', 'name role')
    .populate('proposedWork.createdTask', 'taskId title')
    .populate('predecessorTasks', 'taskId title')
    .populate('successorTasks', 'taskId title')
    .populate('wbsParent', 'title');
}

async function listChangeRequests(projectId) {
  await requireProject(projectId);
  return populateCr(ChangeRequest.find({ project: projectId }).sort({ createdAt: -1 }));
}

async function getChangeRequest(id) {
  await findOr404(ChangeRequest, id, 'Change request');
  return populateCr(ChangeRequest.findById(id));
}

// New work must not join the network in a way that creates a cycle: no successor may already precede a predecessor.
async function assertInsertionIsAcyclic(projectId, predecessorIds, successorIds, session) {
  const deps = await TaskDependency.find({ project: projectId }).session(session).lean();
  const succsOf = new Map();
  for (const d of deps) {
    const k = String(d.predecessor);
    if (!succsOf.has(k)) succsOf.set(k, []);
    succsOf.get(k).push(String(d.successor));
  }
  const reaches = (from, to) => {
    const stack = [from];
    const seen = new Set();
    while (stack.length) {
      const n = stack.pop();
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...(succsOf.get(n) || []));
    }
    return false;
  };
  for (const s of successorIds) {
    for (const p of predecessorIds) {
      if (reaches(String(s), String(p))) {
        throw new AppError(400, 'Inserting this work would create a circular dependency (a successor task already precedes a predecessor task)');
      }
    }
  }
}

/**
 * Body: { project, title, description, justification, costImpact, scheduleImpactWeeks, wbsParent,
 *         predecessorTasks: [taskId], successorTasks: [taskId],
 *         proposedItems: [{ title, description, priority, workTitle, estimatedDuration, plannedCost, assignedTo }] }
 * Each proposed item becomes a Pending requirement (+ the work needed to implement it).
 */
async function createChangeRequest(body) {
  return withTransaction(async (session) => {
    const project = await requireProject(body.project, session);
    const data = pick(body, FIELDS);
    if (data.wbsParent === '') data.wbsParent = null;
    if (data.wbsParent) {
      const parent = await assertSameProject(WBSItem, data.wbsParent, project._id, 'WBS parent', session);
      if (parent.type === 'Work Package') throw new AppError(400, 'New work cannot be placed under a work package');
    }
    const items = Array.isArray(body.proposedItems) ? body.proposedItems : [];
    if (!items.length) throw new AppError(400, 'At least one proposed requirement is required');

    const predecessorTasks = Array.isArray(body.predecessorTasks) ? body.predecessorTasks.filter(Boolean) : [];
    const successorTasks = Array.isArray(body.successorTasks) ? body.successorTasks.filter(Boolean) : [];
    for (const id of [...predecessorTasks, ...successorTasks]) await assertSameProject(Task, id, project._id, 'Linked task', session);
    if (predecessorTasks.some((p) => successorTasks.map(String).includes(String(p)))) {
      throw new AppError(400, 'A task cannot be both a predecessor and a successor of the new work');
    }
    await assertInsertionIsAcyclic(project._id, predecessorTasks, successorTasks, session);

    const totalWorkCost = items.reduce((sum, i) => sum + (Number(i.plannedCost) || 0), 0);
    if (Number(data.costImpact) >= 0 && totalWorkCost > Number(data.costImpact)) {
      throw new AppError(400, `Planned cost of the proposed work (${totalWorkCost}) exceeds the cost impact (${data.costImpact})`);
    }

    const cr = new ChangeRequest({
      ...data,
      project: project._id,
      changeId: await nextCode(ChangeRequest, 'changeId', 'CR', project._id, session),
      predecessorTasks,
      successorTasks,
    });
    await cr.validate();

    const proposedWork = [];
    for (const item of items) {
      if (item.assignedTo) await assertSameProject(TeamMember, item.assignedTo, project._id, 'Assigned team member', session);
      const req = await requirementService.createRequirement(
        { project: project._id, title: item.title, description: item.description, priority: item.priority || 'Medium' },
        session,
        { source: 'Change Request', changeRequest: cr._id, approvalStatus: 'Pending' }
      );
      cr.proposedRequirements.push(req._id);
      if (item.estimatedDuration !== undefined && item.estimatedDuration !== '') {
        proposedWork.push({
          requirement: req._id,
          title: item.workTitle || `${item.title} Development`,
          estimatedDuration: item.estimatedDuration,
          plannedCost: item.plannedCost === undefined || item.plannedCost === '' ? 0 : item.plannedCost,
          assignedTo: item.assignedTo || null,
        });
      }
    }
    cr.proposedWork = proposedWork;
    await cr.save({ session });
    return cr;
  }).then((cr) => getChangeRequest(cr._id));
}

// Claims the Pending -> decided transition atomically; a second approval finds nothing to claim.
async function claimPending(id, status, notes, session) {
  await findOr404(ChangeRequest, id, 'Change request', session);
  const cr = await ChangeRequest.findOneAndUpdate(
    { _id: id, status: 'Pending' },
    { $set: { status, decisionDate: new Date(), decisionNotes: notes || '' } },
    { new: true, session }
  );
  if (!cr) {
    const current = await ChangeRequest.findById(id).session(session).lean();
    throw new AppError(409, `Change request ${current.changeId} has already been ${current.status.toLowerCase()}; its impact cannot be applied again`);
  }
  return cr;
}

async function loadOwnRequirements(cr, session) {
  const reqs = await Requirement.find({ _id: { $in: cr.proposedRequirements } }).session(session);
  if (reqs.length !== cr.proposedRequirements.length) throw new AppError(400, 'A proposed requirement no longer exists');
  for (const r of reqs) {
    if (String(r.project) !== String(cr.project)) {
      throw new AppError(400, `Requirement ${r.reqId} belongs to a different project and cannot be approved by this change request`);
    }
  }
  return reqs;
}

/**
 * Approval applies the full integrated impact in ONE transaction:
 * requirements -> approved scope, budget/duration/deadline, WBS work packages, scheduled tasks with
 * dependencies and planned costs, project plan revision, and a schedule recalculation.
 */
async function approveChangeRequest(id, notes) {
  const result = await withTransaction(async (session) => {
    const cr = await claimPending(id, 'Approved', notes, session);
    const project = await requireProject(cr.project, session);
    const reqs = await loadOwnRequirements(cr, session);

    await Requirement.updateMany({ _id: { $in: reqs.map((r) => r._id) } }, { $set: { approvalStatus: 'Approved' } }, { session });

    project.approvedBudget += cr.costImpact;
    project.durationWeeks += cr.scheduleImpactWeeks;
    await project.save({ session }); // deadline is re-derived from start date + duration

    await assertInsertionIsAcyclic(project._id, cr.predecessorTasks, cr.successorTasks, session);
    for (const work of cr.proposedWork) {
      const req = reqs.find((r) => String(r._id) === String(work.requirement));
      const wbs = await wbsService.createWbsItem(
        { project: project._id, title: work.title, description: `Added by ${cr.changeId}: ${cr.title}`, type: 'Work Package', parent: cr.wbsParent, requirement: req._id },
        session
      );
      const task = await taskService.createTask(
        {
          project: project._id,
          title: work.title,
          description: `${req.reqId} ${req.title} (approved via ${cr.changeId})`,
          assignedTo: work.assignedTo,
          wbsItem: wbs._id,
          estimatedDuration: work.estimatedDuration,
        },
        session,
        { changeRequest: cr._id }
      );
      await ActivityCost.create([{ project: project._id, task: task._id, plannedCost: work.plannedCost }], { session });
      for (const p of cr.predecessorTasks) await taskService.addDependency({ predecessor: p, successor: task._id }, session);
      for (const s of cr.successorTasks) await taskService.addDependency({ predecessor: task._id, successor: s }, session);
      work.createdTask = task._id;
    }
    await cr.save({ session });

    await projectService.recordPlanRevision(
      project,
      `${cr.changeId} approved: ${cr.title} (+PKR ${cr.costImpact.toLocaleString('en-US')}, +${cr.scheduleImpactWeeks} weeks)`,
      cr._id,
      session
    );
    await scheduleService.recalculateProjectSchedule(project._id, session);
    return cr;
  });
  return getChangeRequest(result._id);
}

async function rejectChangeRequest(id, notes) {
  const result = await withTransaction(async (session) => {
    const cr = await claimPending(id, 'Rejected', notes, session);
    const reqs = await loadOwnRequirements(cr, session);
    await Requirement.updateMany({ _id: { $in: reqs.map((r) => r._id) } }, { $set: { approvalStatus: 'Rejected' } }, { session });
    return cr;
  });
  return getChangeRequest(result._id);
}

module.exports = { listChangeRequests, getChangeRequest, createChangeRequest, approveChangeRequest, rejectChangeRequest };
