const { Task, TaskDependency, TeamMember, WBSItem, ActivityCost } = require('../models');
const AppError = require('../utils/AppError');
const { pick } = require('../utils/http');
const { toDay } = require('../utils/dates');
const { withTransaction } = require('../utils/transaction');
const { requireProject, assertSameProject, findOr404, nextCode, assertObjectId } = require('./referenceService');
const { recalculateProjectSchedule } = require('./scheduleService');
const { createsCycle } = require('./schedulingEngine');

const CREATE_FIELDS = ['title', 'description', 'assignedTo', 'wbsItem', 'estimatedDuration'];
const UPDATE_FIELDS = [...CREATE_FIELDS, 'actualStartDate', 'actualEndDate', 'progress', 'status'];

const fail = (field, message) => new AppError(400, message, [{ field, message }]);

function blankToNull(data, fields) {
  for (const f of fields) if (data[f] === '') data[f] = null;
}

async function checkTaskRefs(data, projectId, session) {
  if ('assignedTo' in data) await assertSameProject(TeamMember, data.assignedTo, projectId, 'Assigned team member', session);
  if ('wbsItem' in data) await assertSameProject(WBSItem, data.wbsItem, projectId, 'WBS item', session);
}

// Keeps status, progress and actual dates mutually consistent and honours finish-to-start rules.
async function applyProgressRules(task, statusProvided, session) {
  const progress = Number(task.progress);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) throw fail('progress', 'Progress must be between 0 and 100');

  if (!statusProvided) {
    if (progress === 100) task.status = 'Completed';
    else if (progress > 0) task.status = 'In Progress';
  }
  if (task.status === 'Completed') task.progress = 100;
  if (task.status !== 'Completed' && progress === 100) throw fail('status', 'A task at 100% progress must have status Completed');

  const today = toDay(new Date());
  if (task.actualStartDate && toDay(task.actualStartDate) > today) throw fail('actualStartDate', 'Actual start date cannot be in the future');
  if (task.actualEndDate && toDay(task.actualEndDate) > today) throw fail('actualEndDate', 'Actual end date cannot be in the future');
  if (task.actualStartDate && task.actualEndDate && toDay(task.actualEndDate) < toDay(task.actualStartDate)) {
    throw fail('actualEndDate', 'Actual end date cannot be before the actual start date');
  }

  if (task.status === 'Not Started') {
    if (task.progress > 0) throw fail('progress', 'A task that has not started must have 0% progress');
    if (task.actualStartDate || task.actualEndDate) throw fail('actualStartDate', 'A task that has not started cannot have actual dates');
    return;
  }
  if (!task.actualStartDate) throw fail('actualStartDate', `Actual start date is required for a task that is ${task.status}`);
  if (task.status === 'In Progress' && task.actualEndDate) {
    throw fail('actualEndDate', 'Actual end date can only be recorded when the task is Completed');
  }
  if (task.status === 'Completed' && !task.actualEndDate) throw fail('actualEndDate', 'Actual end date is required for a completed task');

  // Finish-to-start: every predecessor must be finished before this task starts.
  const deps = await TaskDependency.find({ successor: task._id }).populate('predecessor').session(session);
  for (const d of deps) {
    const pred = d.predecessor;
    if (pred.status !== 'Completed') {
      throw fail('status', `Cannot start ${task.taskId}: predecessor ${pred.taskId} (${pred.title}) is not completed`);
    }
    if (toDay(task.actualStartDate) <= toDay(pred.actualEndDate)) {
      throw fail('actualStartDate', `Actual start must be after predecessor ${pred.taskId} finished on ${toDay(pred.actualEndDate).toISOString().slice(0, 10)}`);
    }
  }
}

function populateTask(query) {
  return query.populate('assignedTo', 'name role').populate('wbsItem', 'title type');
}

async function listTasks(projectId) {
  await requireProject(projectId);
  const [tasks, deps, costs] = await Promise.all([
    populateTask(Task.find({ project: projectId }).sort({ plannedStartDate: 1, taskId: 1 })).lean(),
    TaskDependency.find({ project: projectId }).populate('predecessor', 'taskId title').lean(),
    ActivityCost.find({ project: projectId }).lean(),
  ]);
  return tasks.map((t) => ({
    ...t,
    predecessors: deps.filter((d) => String(d.successor) === String(t._id)).map((d) => d.predecessor),
    plannedCost: (costs.find((c) => String(c.task) === String(t._id)) || {}).plannedCost ?? null,
  }));
}

async function createTask(body, session = null, extra = {}) {
  const run = async (s) => {
    const project = await requireProject(body.project, s);
    const data = pick(body, CREATE_FIELDS);
    blankToNull(data, ['assignedTo', 'wbsItem']);
    await checkTaskRefs(data, project._id, s);
    const task = new Task({
      ...data,
      ...extra,
      project: project._id,
      taskId: await nextCode(Task, 'taskId', 'T', project._id, s),
    });
    await task.save({ session: s });
    await recalculateProjectSchedule(project._id, s);
    return task;
  };
  const task = session ? await run(session) : await withTransaction(run);
  return session ? task : populateTask(Task.findById(task._id));
}

async function updateTask(id, body) {
  const task = await withTransaction(async (session) => {
    const t = await findOr404(Task, id, 'Task', session);
    const data = pick(body, UPDATE_FIELDS);
    blankToNull(data, ['assignedTo', 'wbsItem', 'actualStartDate', 'actualEndDate']);
    await checkTaskRefs(data, t.project, session);
    const durationChanged = 'estimatedDuration' in data && Number(data.estimatedDuration) !== t.estimatedDuration;
    t.set(data);
    await t.validate();
    await applyProgressRules(t, 'status' in data, session);
    await t.save({ session });
    if (durationChanged) await recalculateProjectSchedule(t.project, session);
    return t;
  });
  return populateTask(Task.findById(task._id));
}

// ---- Dependencies ----
async function listDependencies(projectId) {
  await requireProject(projectId);
  return TaskDependency.find({ project: projectId })
    .populate('predecessor', 'taskId title')
    .populate('successor', 'taskId title')
    .sort({ createdAt: 1 });
}

async function addDependency({ predecessor, successor }, session = null) {
  assertObjectId(predecessor, 'Predecessor task');
  assertObjectId(successor, 'Successor task');
  if (String(predecessor) === String(successor)) throw new AppError(400, 'A task cannot depend on itself');

  const run = async (s) => {
    const pred = await Task.findById(predecessor).session(s);
    const succ = await Task.findById(successor).session(s);
    if (!pred) throw new AppError(400, 'Predecessor task not found');
    if (!succ) throw new AppError(400, 'Successor task not found');
    if (String(pred.project) !== String(succ.project)) {
      throw new AppError(400, 'Dependencies can only link tasks of the same project');
    }
    const existing = await TaskDependency.find({ project: pred.project }).session(s).lean();
    if (existing.some((d) => String(d.predecessor) === String(pred._id) && String(d.successor) === String(succ._id))) {
      throw new AppError(409, `${succ.taskId} already depends on ${pred.taskId}`);
    }
    if (createsCycle(existing, pred._id, succ._id)) {
      throw new AppError(400, `Circular dependency: ${pred.taskId} already depends (directly or indirectly) on ${succ.taskId}`);
    }
    const [dep] = await TaskDependency.create([{ project: pred.project, predecessor: pred._id, successor: succ._id }], { session: s });
    await recalculateProjectSchedule(pred.project, s);
    return dep;
  };
  const dep = session ? await run(session) : await withTransaction(run);
  return session ? dep : TaskDependency.findById(dep._id).populate('predecessor', 'taskId title').populate('successor', 'taskId title');
}

async function removeDependency(id) {
  return withTransaction(async (session) => {
    const dep = await findOr404(TaskDependency, id, 'Dependency', session);
    await dep.deleteOne({ session });
    await recalculateProjectSchedule(dep.project, session);
    return { _id: dep._id };
  });
}

module.exports = { listTasks, createTask, updateTask, listDependencies, addDependency, removeDependency };
