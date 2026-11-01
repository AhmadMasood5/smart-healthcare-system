const { sendOk, asyncHandler } = require('../utils/http');
const costService = require('../services/costService');
const { crudController } = require('./crudController');

module.exports = {
  activityCosts: crudController(costService.activityCosts),
  expenditures: crudController(costService.expenditures),
  getEvm: asyncHandler(async (req, res) => sendOk(res, await costService.getEvm(req.params.projectId, req.query.reportDate))),
};
