// Pure Earned Value Management calculations.
//
// PV  = sum(plannedCost x plannedFraction(reportDate)), where plannedFraction is linear over the task's
//       planned calendar days: 0 before plannedStart, 1 on/after plannedEnd, otherwise
//       (days elapsed including the report day) / (planned duration in days).
// EV  = sum(plannedCost x progress / 100)
// AC  = sum(expenditure amounts dated on or before the reporting date)
// CPI = EV / AC, SPI = EV / PV (null when the denominator is zero).
const { toDay, diffDays } = require('../utils/dates');

const THRESHOLDS = {
  cpi: { warning: 1, critical: 0.9 },
  spi: { warning: 1, critical: 0.9 },
};

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

function plannedFraction(plannedStart, plannedEnd, reportDate) {
  if (!plannedStart || !plannedEnd) return 0;
  const report = toDay(reportDate);
  if (report < toDay(plannedStart)) return 0;
  if (report >= toDay(plannedEnd)) return 1;
  const duration = diffDays(plannedEnd, plannedStart) + 1;
  return (diffDays(report, plannedStart) + 1) / duration;
}

function calculatePV(items, reportDate) {
  return items.reduce((sum, i) => sum + i.plannedCost * plannedFraction(i.plannedStartDate, i.plannedEndDate, reportDate), 0);
}

function calculateEV(items) {
  return items.reduce((sum, i) => sum + (i.plannedCost * (i.progress || 0)) / 100, 0);
}

function calculateAC(expenditures, reportDate) {
  const report = toDay(reportDate);
  return expenditures.filter((e) => toDay(e.date) <= report).reduce((sum, e) => sum + e.amount, 0);
}

function safeDivide(numerator, denominator) {
  if (!denominator || !Number.isFinite(denominator)) return null;
  return numerator / denominator;
}

function interpretCpi(cpi) {
  if (cpi === null) return 'Not available (no actual cost recorded)';
  if (cpi < 1) return 'Poor cost performance (over budget)';
  if (cpi > 1) return 'Favorable cost performance (under budget)';
  return 'On budget';
}

function interpretSpi(spi) {
  if (spi === null) return 'Not available (no work scheduled yet)';
  if (spi < 1) return 'Behind schedule';
  if (spi > 1) return 'Ahead of schedule';
  return 'On schedule';
}

function calculateEvmIndicators({ pv, ev, ac }) {
  const cpiRaw = safeDivide(ev, ac);
  const spiRaw = safeDivide(ev, pv);
  const cpi = cpiRaw === null ? null : round(cpiRaw, 4);
  const spi = spiRaw === null ? null : round(spiRaw, 4);
  return { pv, ev, ac, cpi, spi, cpiStatus: interpretCpi(cpi), spiStatus: interpretSpi(spi) };
}

function buildCostWarnings({ approvedBudget, totalPlannedCost, actualExpenditure, cpi, spi }) {
  const warnings = [];
  if (cpi !== null && cpi < THRESHOLDS.cpi.warning) {
    warnings.push({
      type: 'COST_PERFORMANCE',
      severity: cpi < THRESHOLDS.cpi.critical ? 'critical' : 'warning',
      message: `Cost performance warning: CPI is ${cpi.toFixed(2)} (below ${THRESHOLDS.cpi.warning}). The project is spending more than the value it earns.`,
    });
  }
  if (spi !== null && spi < THRESHOLDS.spi.warning) {
    warnings.push({
      type: 'SCHEDULE_PERFORMANCE',
      severity: spi < THRESHOLDS.spi.critical ? 'critical' : 'warning',
      message: `Schedule performance warning: SPI is ${spi.toFixed(2)} (below ${THRESHOLDS.spi.warning}). Less work has been completed than planned.`,
    });
  }
  if (actualExpenditure > approvedBudget) {
    warnings.push({
      type: 'BUDGET_OVERRUN',
      severity: 'critical',
      message: `Budget overrun: actual expenditure exceeds the approved budget by PKR ${round(actualExpenditure - approvedBudget).toLocaleString('en-US')}.`,
    });
  }
  if (totalPlannedCost > approvedBudget) {
    warnings.push({
      type: 'PLANNED_COST_EXCEEDS_BUDGET',
      severity: 'warning',
      message: `Planned activity costs exceed the approved budget by PKR ${round(totalPlannedCost - approvedBudget).toLocaleString('en-US')}.`,
    });
  }
  return warnings;
}

module.exports = {
  THRESHOLDS,
  round,
  plannedFraction,
  calculatePV,
  calculateEV,
  calculateAC,
  calculateEvmIndicators,
  buildCostWarnings,
};
