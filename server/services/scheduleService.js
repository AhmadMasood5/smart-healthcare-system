const { Task, TaskDependency, Milestone } = require('../models');
const AppError = require('../utils/AppError');
const { toDay, isValidDate } = require('../utils/dates');
const { requireProject } = require('./referenceService');
const { computePlannedDates, analyzeSchedule } = require('./schedulingEngine');

function parseReportDate(value) {
  if (value === undefined || value === null || value === '') return toDay(new Date());
  if (!isValidDate(value)) throw new AppError(400, 'Reporting date is invalid');
  return toDay(value);
}

// Re-runs the forward pass and persists planned dates on tasks and task-linked milestones.
async function recalculateProjectSchedule(projectId, session = null) {
  const project = await requireProject(projectId, session);
  const tasks = await Task.find({ project: project._id }).session(session);
  const deps = await TaskDependency.find({ project: project._id }).session(session).lean();
  const { planned } = computePlannedDates(project.startDate, tasks, deps);

  const taskOps = [];
  for (const t of tasks) {
    const p = planned.get(String(t._id));
    const changed =
      !t.plannedStartDate ||
      !t.plannedEndDate ||
      toDay(t.plannedStartDate).getTime() !== p.start.getTime() ||
      toDay(t.plannedEndDate).getTime() !== p.end.getTime();
    if (changed) {
      taskOps.push({
        updateOne: { filter: { _id: t._id }, update: { $set: { plannedStartDate: p.start, plannedEndDate: p.end } } },
      });
    }
  }
  if (taskOps.length) await Task.bulkWrite(taskOps, { session });

  const milestones = await Milestone.find({ project: project._id, linkedTask: { $ne: null } }).session(session);
  const msOps = milestones
    .filter((m) => planned.has(String(m.linkedTask)))
    .map((m) => ({
      updateOne: { filter: { _id: m._id }, update: { $set: { plannedDate: planned.get(String(m.linkedTask)).end } } },
    }));
  if (msOps.length) await Milestone.bulkWrite(msOps, { session });

  return planned;
}

async function getProjectSchedule(projectId, reportDateInput) {
  const reportDate = parseReportDate(reportDateInput);
  const project = await requireProject(projectId);
  const [tasks, deps, milestones] = await Promise.all([
    Task.find({ project: project._id }).populate('assignedTo', 'name role').lean(),
    TaskDependency.find({ project: project._id }).lean(),
    Milestone.find({ project: project._id }).sort({ plannedDate: 1 }).lean(),
  ]);
  return analyzeSchedule({ project, tasks, deps, milestones, reportDate });
}

module.exports = { parseReportDate, recalculateProjectSchedule, getProjectSchedule };
