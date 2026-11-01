// Pure scheduling algorithms (no database access) — see utils/dates.js for the calendar convention.
//
// Planned schedule (forward pass, finish-to-start):
//   plannedStart = max(projectStart, latest predecessor plannedEnd + 1 day)
//   plannedEnd   = plannedStart + estimatedDuration - 1
// Float (backward pass) is measured against the approved deadline and the planned completion.
//
// Forecast (uses actual progress as of the reporting date):
//   Completed task   -> actual start / actual end
//   In-progress task -> ends no earlier than its planned length from the actual start, and no earlier
//                       than reportDate + remaining work (duration x (100 - progress)%) - 1
//   Not started task -> starts at max(latest predecessor forecast end + 1, reportDate), runs its duration
// Delay = forecast end - planned end (days, never negative). Delays flow to successors via the forecast pass.
const AppError = require('../utils/AppError');
const { toDay, addDays, diffDays, endDateFor, maxDate } = require('../utils/dates');

const idOf = (v) => String(v && v._id ? v._id : v);

function buildGraph(tasks, deps) {
  const preds = new Map();
  const succs = new Map();
  for (const t of tasks) {
    preds.set(idOf(t), []);
    succs.set(idOf(t), []);
  }
  for (const d of deps) {
    const p = idOf(d.predecessor);
    const s = idOf(d.successor);
    if (preds.has(s) && succs.has(p)) {
      preds.get(s).push(p);
      succs.get(p).push(s);
    }
  }
  return { preds, succs };
}

// Kahn's algorithm. Throws if the dependency graph contains a cycle.
function topologicalOrder(tasks, graph) {
  const inDegree = new Map(tasks.map((t) => [idOf(t), graph.preds.get(idOf(t)).length]));
  const queue = tasks.filter((t) => inDegree.get(idOf(t)) === 0).map(idOf);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const s of graph.succs.get(id)) {
      inDegree.set(s, inDegree.get(s) - 1);
      if (inDegree.get(s) === 0) queue.push(s);
    }
  }
  if (order.length !== tasks.length) throw new AppError(400, 'Circular dependency detected in the task network');
  return order;
}

// Would adding predecessor -> successor create a cycle? True if successor already reaches predecessor.
function createsCycle(deps, predecessorId, successorId) {
  const p = String(predecessorId);
  const s = String(successorId);
  if (p === s) return true;
  const succs = new Map();
  for (const d of deps) {
    const from = idOf(d.predecessor);
    if (!succs.has(from)) succs.set(from, []);
    succs.get(from).push(idOf(d.successor));
  }
  const stack = [s];
  const seen = new Set();
  while (stack.length) {
    const node = stack.pop();
    if (node === p) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of succs.get(node) || []) stack.push(next);
  }
  return false;
}

function computePlannedDates(projectStart, tasks, deps) {
  const graph = buildGraph(tasks, deps);
  const order = topologicalOrder(tasks, graph);
  const byId = new Map(tasks.map((t) => [idOf(t), t]));
  const planned = new Map();
  for (const id of order) {
    const predEnds = graph.preds.get(id).map((p) => planned.get(p).end);
    const earliest = predEnds.length ? addDays(maxDate(predEnds), 1) : toDay(projectStart);
    const start = maxDate([earliest, projectStart]);
    planned.set(id, { start, end: endDateFor(start, byId.get(id).estimatedDuration) });
  }
  return { planned, order, graph };
}

function transitiveSuccessors(id, graph) {
  const result = [];
  const seen = new Set();
  const stack = [...graph.succs.get(id)];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    result.push(n);
    stack.push(...graph.succs.get(n));
  }
  return result;
}

function analyzeSchedule({ project, tasks, deps, milestones = [], reportDate = new Date() }) {
  const report = toDay(reportDate);
  const projectStart = toDay(project.startDate);
  const deadline = toDay(project.deadline);
  const { planned, order, graph } = computePlannedDates(projectStart, tasks, deps);
  const byId = new Map(tasks.map((t) => [idOf(t), t]));

  const plannedCompletion = maxDate([...planned.values()].map((p) => p.end)) || projectStart;

  // Backward pass against the approved deadline.
  const lateStart = new Map();
  for (const id of [...order].reverse()) {
    const succLs = graph.succs.get(id).map((s) => addDays(lateStart.get(s), -1));
    const lateFinish = succLs.length ? new Date(Math.min(...succLs.map((d) => d.getTime()))) : deadline;
    lateStart.set(id, addDays(lateFinish, -(byId.get(id).estimatedDuration - 1)));
  }
  const deadlineBuffer = diffDays(deadline, plannedCompletion);

  // Forward forecast pass using actual progress.
  const forecast = new Map();
  for (const id of order) {
    const t = byId.get(id);
    const dur = t.estimatedDuration;
    const predEnds = graph.preds.get(id).map((p) => forecast.get(p).end);
    const earliestFromPreds = predEnds.length ? addDays(maxDate(predEnds), 1) : projectStart;
    let start;
    let end;
    if (t.status === 'Completed') {
      start = toDay(t.actualStartDate || planned.get(id).start);
      end = toDay(t.actualEndDate || planned.get(id).end);
    } else if (t.actualStartDate) {
      start = toDay(t.actualStartDate);
      const remaining = Math.max(1, Math.ceil((dur * (100 - (t.progress || 0))) / 100));
      end = maxDate([endDateFor(start, dur), addDays(report, remaining - 1)]);
    } else {
      start = maxDate([earliestFromPreds, projectStart, report]);
      end = endDateFor(start, dur);
    }
    forecast.set(id, { start, end, earliestFromPreds });
  }

  const rows = order.map((id) => {
    const t = byId.get(id);
    const p = planned.get(id);
    const f = forecast.get(id);
    const delayDays = Math.max(0, diffDays(f.end, p.end));
    const floatToDeadline = diffDays(lateStart.get(id), p.start);
    const totalFloat = floatToDeadline - deadlineBuffer;
    let delayCause = null;
    if (delayDays > 0) {
      if (t.status === 'Completed') delayCause = 'Finished late';
      else if (t.actualStartDate) delayCause = 'Progress behind plan';
      else if (diffDays(f.earliestFromPreds, p.start) > 0) delayCause = 'Predecessor delay';
      else delayCause = 'Late start';
    }
    return {
      id,
      taskId: t.taskId,
      title: t.title,
      status: t.status,
      progress: t.progress || 0,
      estimatedDuration: t.estimatedDuration,
      assignedTo: t.assignedTo && t.assignedTo.name ? { _id: t.assignedTo._id, name: t.assignedTo.name, role: t.assignedTo.role } : t.assignedTo || null,
      predecessors: graph.preds.get(id),
      successors: graph.succs.get(id),
      plannedStart: p.start,
      plannedEnd: p.end,
      actualStart: t.actualStartDate || null,
      actualEnd: t.actualEndDate || null,
      forecastStart: f.start,
      forecastEnd: f.end,
      delayDays,
      delayCause,
      isDelayed: t.status !== 'Completed' && delayDays > 0,
      completedLate: t.status === 'Completed' && delayDays > 0,
      totalFloat,
      floatToDeadline,
      isCritical: totalFloat === 0,
      // How far this task's slip pushes the project finish beyond its planned completion.
      completionImpactDays: Math.max(0, delayDays - Math.max(0, totalFloat)),
    };
  });

  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) {
    r.predecessorTaskIds = r.predecessors.map((p) => rowById.get(p).taskId);
    r.impactedTasks =
      r.delayDays > 0
        ? transitiveSuccessors(r.id, graph)
            .map((s) => rowById.get(s))
            .filter((s) => diffDays(s.forecastStart, s.plannedStart) > 0)
            .map((s) => ({ id: s.id, taskId: s.taskId, title: s.title, shiftDays: diffDays(s.forecastStart, s.plannedStart) }))
        : [];
  }

  const forecastCompletion = maxDate(rows.map((r) => r.forecastEnd)) || projectStart;
  const assigned = new Set(tasks.filter((t) => t.assignedTo).map((t) => idOf(t.assignedTo)));

  const milestoneRows = milestones.map((m) => {
    const linked = m.linkedTask ? rowById.get(idOf(m.linkedTask)) : null;
    return {
      id: String(m._id),
      title: m.title,
      plannedDate: m.plannedDate,
      forecastDate: linked ? linked.forecastEnd : m.plannedDate,
      actualCompletionDate: m.actualCompletionDate,
      completionStatus: m.completionStatus,
      linkedTaskId: linked ? linked.taskId : null,
    };
  });

  return {
    reportDate: report,
    projectStart,
    deadline,
    tasks: rows,
    milestones: milestoneRows,
    criticalPath: rows.filter((r) => r.isCritical).map((r) => r.taskId),
    summary: {
      totalTasks: rows.length,
      completedTasks: rows.filter((r) => r.status === 'Completed').length,
      inProgressTasks: rows.filter((r) => r.status === 'In Progress').length,
      notStartedTasks: rows.filter((r) => r.status === 'Not Started').length,
      delayedTasks: rows.filter((r) => r.isDelayed).length,
      assignedMembers: assigned.size,
      plannedCompletion,
      forecastCompletion,
      approvedDeadline: deadline,
      // Positive = forecast finishes after the approved deadline.
      forecastVsDeadlineDays: diffDays(forecastCompletion, deadline),
      forecastVsPlannedDays: diffDays(forecastCompletion, plannedCompletion),
    },
  };
}

module.exports = { buildGraph, topologicalOrder, createsCycle, computePlannedDates, analyzeSchedule };
