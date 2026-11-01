// Integrates every module into one dashboard / status report computed from live database state.
const { ChangeRequest, Requirement, Defect } = require('../models');
const { requireProject } = require('./referenceService');
const { getProjectSchedule, parseReportDate } = require('./scheduleService');
const { getEvm } = require('./costService');
const { summariseDefects } = require('./qualityService');
const { listRankedRisks } = require('./riskService');
const { round } = require('./evmEngine');

function scheduleWarnings(summary, delayed) {
  const warnings = [];
  if (delayed.length) {
    warnings.push({
      type: 'SCHEDULE_DELAY',
      severity: 'warning',
      message: `${delayed.length} activit${delayed.length === 1 ? 'y is' : 'ies are'} delayed: ${delayed.map((t) => `${t.taskId} (+${t.delayDays}d)`).join(', ')}.`,
    });
  }
  if (summary.forecastVsDeadlineDays > 0) {
    warnings.push({
      type: 'DEADLINE_AT_RISK',
      severity: 'critical',
      message: `Forecast completion is ${summary.forecastVsDeadlineDays} day(s) after the approved deadline.`,
    });
  }
  return warnings;
}

async function getDashboard(projectId, reportDateInput) {
  const reportDate = parseReportDate(reportDateInput);
  const project = await requireProject(projectId);
  const [schedule, evm, crs, reqs, defects, risks] = await Promise.all([
    getProjectSchedule(projectId, reportDate),
    getEvm(projectId, reportDate),
    ChangeRequest.find({ project: projectId }).select('changeId title status costImpact scheduleImpactWeeks createdAt').lean(),
    Requirement.find({ project: projectId }).select('approvalStatus').lean(),
    Defect.find({ project: projectId }).lean(),
    listRankedRisks(projectId),
  ]);

  // Overall progress = earned value as a share of total planned activity cost (cost-weighted % complete).
  const overallProgress =
    evm.totalPlannedCost > 0
      ? round((evm.ev / evm.totalPlannedCost) * 100, 1)
      : schedule.tasks.length
        ? round(schedule.tasks.reduce((s, t) => s + t.progress, 0) / schedule.tasks.length, 1)
        : 0;

  const quality = summariseDefects(defects);
  const delayed = schedule.tasks.filter((t) => t.isDelayed);
  const warnings = [...evm.warnings, ...scheduleWarnings(schedule.summary, delayed)];
  if (quality.unresolvedCritical > 0) {
    warnings.push({
      type: 'CRITICAL_DEFECTS',
      severity: 'critical',
      message: `${quality.unresolvedCritical} critical defect(s) unresolved: ${quality.unresolvedCriticalDefects.map((d) => d.title).join(', ')}.`,
    });
  }

  const countStatus = (s) => crs.filter((c) => c.status === s).length;
  return {
    reportDate,
    project: {
      _id: project._id,
      name: project.name,
      status: project.status,
      projectManager: project.projectManager,
      approvedBudget: project.approvedBudget,
      durationWeeks: project.durationWeeks,
      startDate: project.startDate,
      deadline: project.deadline,
      overallProgress,
    },
    tasks: { ...schedule.summary },
    changeRequests: {
      pending: countStatus('Pending'),
      approved: countStatus('Approved'),
      rejected: countStatus('Rejected'),
      pendingList: crs.filter((c) => c.status === 'Pending'),
    },
    scope: {
      approvedRequirements: reqs.filter((r) => r.approvalStatus === 'Approved').length,
      pendingRequirements: reqs.filter((r) => r.approvalStatus === 'Pending').length,
    },
    financial: {
      approvedBudget: evm.approvedBudget,
      totalPlannedCost: evm.totalPlannedCost,
      actualExpenditure: evm.actualExpenditure,
      remainingBudget: evm.remainingBudget,
      pv: evm.pv,
      ev: evm.ev,
      ac: evm.ac,
      cpi: evm.cpi,
      spi: evm.spi,
      cpiStatus: evm.cpiStatus,
      spiStatus: evm.spiStatus,
    },
    quality,
    risks: {
      total: risks.length,
      highPriority: risks.filter((r) => r.priority === 'High'),
    },
    delayedActivities: delayed.map((t) => ({
      taskId: t.taskId,
      title: t.title,
      delayDays: t.delayDays,
      delayCause: t.delayCause,
      completionImpactDays: t.completionImpactDays,
      plannedEnd: t.plannedEnd,
      forecastEnd: t.forecastEnd,
    })),
    warnings,
  };
}

async function getProjectReport(projectId, reportDateInput) {
  const d = await getDashboard(projectId, reportDateInput);
  return {
    generatedAt: new Date(),
    reportDate: d.reportDate,
    project: d.project,
    overallProgress: d.project.overallProgress,
    schedule: {
      totalTasks: d.tasks.totalTasks,
      completedTasks: d.tasks.completedTasks,
      inProgressTasks: d.tasks.inProgressTasks,
      delayedTasks: d.tasks.delayedTasks,
      plannedCompletion: d.tasks.plannedCompletion,
      forecastCompletion: d.tasks.forecastCompletion,
      approvedDeadline: d.tasks.approvedDeadline,
      forecastVsDeadlineDays: d.tasks.forecastVsDeadlineDays,
    },
    pendingChangeRequests: d.changeRequests.pendingList,
    delayedActivities: d.delayedActivities,
    budgetStatus: {
      approvedBudget: d.financial.approvedBudget,
      totalPlannedCost: d.financial.totalPlannedCost,
      actualExpenditure: d.financial.actualExpenditure,
      remainingBudget: d.financial.remainingBudget,
      overBudget: d.financial.actualExpenditure > d.financial.approvedBudget,
    },
    evm: {
      pv: d.financial.pv,
      ev: d.financial.ev,
      ac: d.financial.ac,
      cpi: d.financial.cpi,
      spi: d.financial.spi,
      cpiStatus: d.financial.cpiStatus,
      spiStatus: d.financial.spiStatus,
    },
    unresolvedCriticalDefects: d.quality.unresolvedCriticalDefects,
    highPriorityRisks: d.risks.highPriority.map((r) => ({ riskId: r.riskId, title: r.title, score: r.score })),
    warnings: d.warnings,
  };
}

module.exports = { getDashboard, getProjectReport };
