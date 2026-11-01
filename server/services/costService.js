const { Task, ActivityCost, Expenditure } = require('../models');
const AppError = require('../utils/AppError');
const { toDay } = require('../utils/dates');
const { requireProject } = require('./referenceService');
const { createCrudService } = require('./crudService');
const { parseReportDate } = require('./scheduleService');
const evm = require('./evmEngine');

const activityCosts = createCrudService(ActivityCost, {
  label: 'Activity cost',
  fields: ['task', 'plannedCost'],
  refs: { task: [Task, 'Task'] },
  populate: [{ path: 'task', select: 'taskId title plannedStartDate plannedEndDate' }],
});

const expenditures = createCrudService(Expenditure, {
  label: 'Expenditure',
  fields: ['task', 'amount', 'date', 'description'],
  refs: { task: [Task, 'Related task'] },
  sort: { date: -1 },
  populate: [{ path: 'task', select: 'taskId title' }],
  validate: async (doc, project) => {
    if (doc.date && toDay(doc.date) < toDay(project.startDate)) {
      throw new AppError(400, 'Expenditure date cannot be before the project start date', [
        { field: 'date', message: 'Expenditure date cannot be before the project start date' },
      ]);
    }
    if (doc.date && toDay(doc.date) > toDay(new Date())) {
      throw new AppError(400, 'Expenditure date cannot be in the future', [{ field: 'date', message: 'Expenditure date cannot be in the future' }]);
    }
  },
});

async function getEvm(projectId, reportDateInput) {
  const reportDate = parseReportDate(reportDateInput);
  const project = await requireProject(projectId);
  const [tasks, costs, spend] = await Promise.all([
    Task.find({ project: project._id }).lean(),
    ActivityCost.find({ project: project._id }).lean(),
    Expenditure.find({ project: project._id }).lean(),
  ]);
  const costByTask = new Map(costs.map((c) => [String(c.task), c.plannedCost]));

  const breakdown = tasks
    .map((t) => {
      const plannedCost = costByTask.get(String(t._id)) || 0;
      const fraction = evm.plannedFraction(t.plannedStartDate, t.plannedEndDate, reportDate);
      const taskSpend = spend.filter((e) => String(e.task) === String(t._id));
      return {
        taskRef: t._id,
        taskId: t.taskId,
        title: t.title,
        plannedCost,
        plannedStartDate: t.plannedStartDate,
        plannedEndDate: t.plannedEndDate,
        plannedPercent: evm.round(fraction * 100, 1),
        progress: t.progress || 0,
        pv: evm.round(plannedCost * fraction),
        ev: evm.round((plannedCost * (t.progress || 0)) / 100),
        ac: evm.round(evm.calculateAC(taskSpend, reportDate)),
      };
    })
    .sort((a, b) => a.taskId.localeCompare(b.taskId, undefined, { numeric: true }));

  const items = tasks.map((t) => ({ ...t, plannedCost: costByTask.get(String(t._id)) || 0 }));
  const pv = evm.round(evm.calculatePV(items, reportDate));
  const ev = evm.round(evm.calculateEV(items));
  const ac = evm.round(evm.calculateAC(spend, reportDate));
  const indicators = evm.calculateEvmIndicators({ pv, ev, ac });
  const totalPlannedCost = evm.round(costs.reduce((s, c) => s + c.plannedCost, 0));
  const actualExpenditure = evm.round(spend.reduce((s, e) => s + e.amount, 0));

  return {
    reportDate,
    approvedBudget: project.approvedBudget,
    totalPlannedCost,
    unallocatedBudget: evm.round(project.approvedBudget - totalPlannedCost),
    actualExpenditure,
    remainingBudget: evm.round(project.approvedBudget - actualExpenditure),
    budgetUtilisationPercent: evm.round((actualExpenditure / project.approvedBudget) * 100, 1),
    unestimatedTasks: tasks.filter((t) => !costByTask.has(String(t._id))).map((t) => t.taskId),
    ...indicators,
    thresholds: evm.THRESHOLDS,
    warnings: evm.buildCostWarnings({
      approvedBudget: project.approvedBudget,
      totalPlannedCost,
      actualExpenditure,
      cpi: indicators.cpi,
      spi: indicators.spi,
    }),
    breakdown,
  };
}

module.exports = { activityCosts, expenditures, getEvm };
