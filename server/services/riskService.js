const { Risk, RiskResponse } = require('../models');
const { createCrudService } = require('./crudService');
const { requireProject } = require('./referenceService');

// score and priority are deliberately not editable: they are always computed from likelihood x impact.
const risks = createCrudService(Risk, {
  label: 'Risk',
  fields: ['title', 'description', 'likelihood', 'impact'],
  code: { field: 'riskId', prefix: 'RSK' },
});

const responses = createCrudService(RiskResponse, {
  label: 'Risk response',
  fields: ['risk', 'potentialProblem', 'preventiveAction', 'correctiveAction'],
  refs: { risk: [Risk, 'Related risk'] },
  populate: [{ path: 'risk', select: 'riskId title score priority' }],
});

// Highest score first; ties broken by impact, then likelihood.
function rankRisks(list) {
  return [...list]
    .sort((a, b) => b.score - a.score || b.impact - a.impact || b.likelihood - a.likelihood || a.riskId.localeCompare(b.riskId))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

async function listRankedRisks(projectId) {
  await requireProject(projectId);
  return rankRisks(await Risk.find({ project: projectId }).lean());
}

// 5x5 grid: rows = impact (5 -> 1), columns = likelihood (1 -> 5).
async function getRiskMatrix(projectId) {
  const ranked = await listRankedRisks(projectId);
  const cells = [];
  for (let impact = 5; impact >= 1; impact -= 1) {
    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      const score = likelihood * impact;
      cells.push({
        likelihood,
        impact,
        score,
        risks: ranked.filter((r) => r.likelihood === likelihood && r.impact === impact).map((r) => ({ _id: r._id, riskId: r.riskId, title: r.title, rank: r.rank })),
      });
    }
  }
  return { cells, ranked };
}

// Process Decision Program Chart: objective -> risk -> potential problem -> preventive / corrective actions.
async function getPdpc(projectId) {
  const project = await requireProject(projectId);
  const [ranked, resp] = await Promise.all([listRankedRisks(projectId), RiskResponse.find({ project: projectId }).lean()]);
  return {
    objective: project.name,
    risks: ranked.map((r) => ({
      _id: r._id,
      riskId: r.riskId,
      title: r.title,
      score: r.score,
      priority: r.priority,
      problems: resp
        .filter((x) => String(x.risk) === String(r._id))
        .map((x) => ({ _id: x._id, potentialProblem: x.potentialProblem, preventiveAction: x.preventiveAction, correctiveAction: x.correctiveAction })),
    })),
  };
}

module.exports = { risks, responses, rankRisks, listRankedRisks, getRiskMatrix, getPdpc };
