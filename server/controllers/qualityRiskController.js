const { sendOk, asyncHandler } = require('../utils/http');
const qualityService = require('../services/qualityService');
const riskService = require('../services/riskService');
const { crudController } = require('./crudController');

module.exports = {
  defects: crudController(qualityService.defects, { list: qualityService.listDefects }),
  defectStats: asyncHandler(async (req, res) => sendOk(res, await qualityService.getDefectStats(req.params.projectId))),
  checklists: crudController(qualityService.checklists),
  checklistSummary: asyncHandler(async (req, res) => sendOk(res, await qualityService.getChecklistSummary(req.params.projectId))),

  risks: crudController(riskService.risks, { list: riskService.listRankedRisks }),
  riskMatrix: asyncHandler(async (req, res) => sendOk(res, await riskService.getRiskMatrix(req.params.projectId))),
  riskResponses: crudController(riskService.responses),
  pdpc: asyncHandler(async (req, res) => sendOk(res, await riskService.getPdpc(req.params.projectId))),
};
