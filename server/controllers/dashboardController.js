const { sendOk, asyncHandler } = require('../utils/http');
const dashboardService = require('../services/dashboardService');

module.exports = {
  getDashboard: asyncHandler(async (req, res) =>
    sendOk(res, await dashboardService.getDashboard(req.params.projectId, req.query.reportDate))
  ),
  getReport: asyncHandler(async (req, res) =>
    sendOk(res, await dashboardService.getProjectReport(req.params.projectId, req.query.reportDate))
  ),
};
