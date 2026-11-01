// Idempotent seed: every record is looked up by its natural key and only inserted when missing,
// so re-running never duplicates demo data and never touches other projects' data.
// `--reset` deletes ONLY the demo project's records and re-creates them (useful before a demonstration).
const mongoose = require('mongoose');
const m = require('../models');
const data = require('./seedData');
const { toDay, addDays } = require('../utils/dates');
const { recalculateProjectSchedule } = require('../services/scheduleService');

const DEMO_COLLECTIONS = [
  'Stakeholder', 'ProjectPlan', 'TeamMember', 'Milestone', 'Requirement', 'WBSItem', 'ChangeRequest', 'Task',
  'TaskDependency', 'ActivityCost', 'Expenditure', 'Defect', 'QualityChecklist', 'Risk', 'RiskResponse', 'ProjectClosure',
];

function demoStartDate(now = new Date()) {
  const d = addDays(now, -data.startOffsetDays);
  const weekday = d.getUTCDay(); // 0 = Sunday
  return addDays(d, -((weekday + 6) % 7)); // back to Monday
}

async function ensure(Model, filter, values, counter) {
  const existing = await Model.findOne(filter);
  if (existing) return existing;
  const doc = await new Model({ ...filter, ...values }).save();
  counter[Model.modelName] = (counter[Model.modelName] || 0) + 1;
  return doc;
}

async function resetDemoProject() {
  const project = await m.Project.findOne({ name: data.project.name });
  if (!project) return;
  for (const name of DEMO_COLLECTIONS) await m[name].deleteMany({ project: project._id });
  await project.deleteOne();
}

async function seedDatabase({ reset = false, now = new Date() } = {}) {
  if (reset) await resetDemoProject();
  const created = {};
  const start = demoStartDate(now);
  const day = (n) => addDays(start, n - 1);

  const project = await ensure(m.Project, { name: data.project.name }, { ...data.project, startDate: start }, created);
  const P = project._id;

  for (const s of data.stakeholders) await ensure(m.Stakeholder, { project: P, name: s.name }, s, created);

  const members = {};
  for (const t of data.team) members[t.name] = await ensure(m.TeamMember, { project: P, name: t.name }, t, created);

  const reqs = {};
  for (const r of data.requirements) {
    reqs[r.reqId] = await ensure(m.Requirement, { project: P, reqId: r.reqId }, { ...r, approvalStatus: 'Approved', source: 'Original' }, created);
  }

  const wbs = {};
  for (const [order, [title, type, parentTitle, reqId]] of data.wbs.entries()) {
    const parent = parentTitle ? wbs[parentTitle]._id : null;
    wbs[title] = await ensure(
      m.WBSItem,
      { project: P, parent, title },
      { type, requirement: reqId ? reqs[reqId]._id : null, order },
      created
    );
  }

  const tasks = {};
  for (const t of data.tasks) {
    const values = {
      title: t.title,
      description: `${t.title} for the Smart Healthcare platform`,
      assignedTo: members[t.member]._id,
      wbsItem: wbs[t.wbs]._id,
      estimatedDuration: t.duration,
      progress: t.progress || 0,
      status: t.progress === 100 ? 'Completed' : t.progress > 0 ? 'In Progress' : 'Not Started',
      actualStartDate: t.actual ? day(t.actual[0]) : null,
      actualEndDate: t.actual && t.actual[1] ? day(t.actual[1]) : null,
    };
    tasks[t.taskId] = await ensure(m.Task, { project: P, taskId: t.taskId }, values, created);
  }
  for (const t of data.tasks) {
    for (const p of t.preds) {
      await ensure(m.TaskDependency, { predecessor: tasks[p]._id, successor: tasks[t.taskId]._id }, { project: P }, created);
    }
    await ensure(m.ActivityCost, { task: tasks[t.taskId]._id }, { project: P, plannedCost: t.cost }, created);
    if (t.spend) {
      await ensure(
        m.Expenditure,
        { project: P, task: tasks[t.taskId]._id, description: `${t.title} - labour and services` },
        { amount: t.spend[0], date: day(t.spend[1]) },
        created
      );
    }
  }
  await recalculateProjectSchedule(P);

  if (!(await m.ProjectPlan.exists({ project: P }))) {
    const fresh = await m.Project.findById(P);
    await ensure(
      m.ProjectPlan,
      { project: P },
      {
        ...data.plan,
        baselineBudget: fresh.approvedBudget,
        baselineDurationWeeks: fresh.durationWeeks,
        baselineDeadline: fresh.deadline,
        revisions: [{ version: 1, description: 'Initial project management plan' }],
      },
      created
    );
  }

  for (const [title, description, taskId, done] of data.milestones) {
    const task = await m.Task.findById(tasks[taskId]._id);
    await ensure(
      m.Milestone,
      { project: P, title },
      {
        description,
        linkedTask: task._id,
        plannedDate: task.plannedEndDate,
        completionStatus: done ? 'Completed' : 'Pending',
        actualCompletionDate: done ? task.actualEndDate : null,
      },
      created
    );
  }

  const cr = data.changeRequest;
  if (!(await m.ChangeRequest.exists({ project: P, changeId: cr.changeId }))) {
    const crId = new mongoose.Types.ObjectId();
    const proposed = [];
    for (const item of cr.items) {
      const req = await ensure(
        m.Requirement,
        { project: P, reqId: item.reqId },
        { title: item.title, description: item.description, priority: item.priority, approvalStatus: 'Pending', source: 'Change Request', changeRequest: crId },
        created
      );
      proposed.push({ req, item });
    }
    await ensure(
      m.ChangeRequest,
      { project: P, changeId: cr.changeId },
      {
        _id: crId,
        title: cr.title,
        description: cr.description,
        justification: cr.justification,
        costImpact: cr.costImpact,
        scheduleImpactWeeks: cr.scheduleImpactWeeks,
        status: 'Pending',
        wbsParent: wbs[cr.wbsParent]._id,
        predecessorTasks: cr.predecessorTasks.map((id) => tasks[id]._id),
        successorTasks: cr.successorTasks.map((id) => tasks[id]._id),
        proposedRequirements: proposed.map((p) => p.req._id),
        proposedWork: proposed.map(({ req, item }) => ({
          requirement: req._id,
          title: item.workTitle,
          estimatedDuration: item.duration,
          plannedCost: item.cost,
          assignedTo: members[item.member]._id,
        })),
      },
      created
    );
  }

  for (const d of data.defects) {
    await ensure(
      m.Defect,
      { project: P, defectId: d.defectId },
      { title: d.title, description: d.description, severity: d.severity, status: d.status, assignedTo: members[d.member]._id, relatedTask: tasks[d.task]._id },
      created
    );
  }

  for (const [deliverable, item, inspectionResult, status, remarks] of data.checklists) {
    await ensure(m.QualityChecklist, { project: P, deliverable, item }, { inspectionResult, status, remarks }, created);
  }

  const risks = {};
  for (const r of data.risks) risks[r.riskId] = await ensure(m.Risk, { project: P, riskId: r.riskId }, r, created);
  for (const [riskId, potentialProblem, preventiveAction, correctiveAction] of data.riskResponses) {
    await ensure(m.RiskResponse, { risk: risks[riskId]._id, potentialProblem }, { project: P, preventiveAction, correctiveAction }, created);
  }

  return { projectId: P, startDate: toDay(project.startDate), created };
}

module.exports = { seedDatabase, demoStartDate };

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const { connectDatabase, disconnectDatabase } = require('../config/database');
  const reset = process.argv.includes('--reset');
  connectDatabase()
    .then(() => seedDatabase({ reset }))
    .then(async ({ projectId, startDate, created }) => {
      const total = Object.values(created).reduce((a, b) => a + b, 0);
      console.log(`Seed complete for project ${projectId} (start ${startDate.toISOString().slice(0, 10)}).`);
      console.log(total ? `Inserted: ${JSON.stringify(created)}` : 'No new records needed - demo data already present.');
      await disconnectDatabase();
    })
    .catch(async (err) => {
      console.error(`Seeding failed: ${err.message}`);
      await disconnectDatabase();
      process.exit(1);
    });
}
