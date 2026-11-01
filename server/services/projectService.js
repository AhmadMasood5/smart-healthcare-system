const { Project, ProjectPlan, ProjectClosure } = require('../models');
const AppError = require('../utils/AppError');
const { pick } = require('../utils/http');
const { toDay } = require('../utils/dates');
const { withTransaction } = require('../utils/transaction');
const { requireProject, findOr404 } = require('./referenceService');
const { recalculateProjectSchedule } = require('./scheduleService');

const PROJECT_FIELDS = [
  'name',
  'description',
  'objectives',
  'scopeBoundaries',
  'approvedBudget',
  'startDate',
  'durationWeeks',
  'projectManager',
  'status',
];
const PLAN_FIELDS = ['scopePlan', 'schedulePlan', 'costPlan', 'qualityPlan'];
const CLOSURE_FIELDS = ['closureDate', 'closureStatus', 'closureNotes', 'finalSummary'];

function normaliseProjectInput(body) {
  const data = pick(body, PROJECT_FIELDS);
  if (typeof data.objectives === 'string') {
    data.objectives = data.objectives.split('\n').map((o) => o.trim()).filter(Boolean);
  }
  return data;
}

// ---- Project charter ----
async function listProjects() {
  return Project.find().sort({ createdAt: 1 });
}

async function getProject(id) {
  return findOr404(Project, id, 'Project');
}

async function createProject(body) {
  const project = new Project(normaliseProjectInput(body));
  await project.save();
  return project;
}

async function updateProject(id, body) {
  return withTransaction(async (session) => {
    const project = await findOr404(Project, id, 'Project', session);
    const before = {
      budget: project.approvedBudget,
      weeks: project.durationWeeks,
      start: project.startDate ? toDay(project.startDate).getTime() : null,
    };
    project.set(normaliseProjectInput(body));
    await project.save({ session });

    const startChanged = before.start !== toDay(project.startDate).getTime();
    const baselineChanged = startChanged || before.budget !== project.approvedBudget || before.weeks !== project.durationWeeks;
    if (startChanged) await recalculateProjectSchedule(project._id, session);
    if (baselineChanged) {
      await recordPlanRevision(project, 'Project charter baseline (budget, duration or start date) updated', null, session);
    }
    return project;
  });
}

// ---- Project management plan ----
async function getPlan(projectId) {
  await requireProject(projectId);
  return ProjectPlan.findOne({ project: projectId });
}

async function createPlan(body) {
  const project = await requireProject(body.project);
  const plan = new ProjectPlan({
    ...pick(body, PLAN_FIELDS),
    project: project._id,
    baselineBudget: project.approvedBudget,
    baselineDurationWeeks: project.durationWeeks,
    baselineDeadline: project.deadline,
    revisions: [{ version: 1, description: 'Initial project management plan' }],
  });
  await plan.save();
  return plan;
}

async function updatePlan(id, body) {
  const plan = await findOr404(ProjectPlan, id, 'Project plan');
  plan.set(pick(body, PLAN_FIELDS));
  plan.version += 1;
  plan.revisions.push({ version: plan.version, description: body.revisionNote || 'Plan content updated' });
  await plan.save();
  return plan;
}

// Re-baselines the plan from the project's current approved values (used by charter edits and change approvals).
async function recordPlanRevision(project, description, changeRequestId, session) {
  const plan = await ProjectPlan.findOne({ project: project._id }).session(session);
  if (!plan) return null;
  plan.version += 1;
  plan.baselineBudget = project.approvedBudget;
  plan.baselineDurationWeeks = project.durationWeeks;
  plan.baselineDeadline = project.deadline;
  plan.revisions.push({ version: plan.version, description, changeRequest: changeRequestId });
  await plan.save({ session });
  return plan;
}

// ---- Project closure ----
async function getClosure(projectId) {
  await requireProject(projectId);
  return ProjectClosure.findOne({ project: projectId });
}

async function saveClosure(closure, body, session) {
  const project = await requireProject(closure.project, session);
  closure.set(pick(body, CLOSURE_FIELDS));
  if (closure.closureDate && toDay(closure.closureDate) < toDay(project.startDate)) {
    throw new AppError(400, 'Closure date cannot be before the project start date', [
      { field: 'closureDate', message: 'Closure date cannot be before the project start date' },
    ]);
  }
  await closure.save({ session });
  // A finalised closure formally closes the project.
  if (closure.closureStatus === 'Final' && project.status !== 'Closed') {
    project.status = 'Closed';
    await project.save({ session });
  }
  return closure;
}

async function createClosure(body) {
  return withTransaction(async (session) => {
    await requireProject(body.project, session);
    const closure = new ProjectClosure({ project: body.project });
    return saveClosure(closure, body, session);
  });
}

async function updateClosure(id, body) {
  return withTransaction(async (session) => {
    const closure = await findOr404(ProjectClosure, id, 'Closure record', session);
    return saveClosure(closure, body, session);
  });
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  getPlan,
  createPlan,
  updatePlan,
  recordPlanRevision,
  getClosure,
  createClosure,
  updateClosure,
};
