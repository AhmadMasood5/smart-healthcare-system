const { sendOk, asyncHandler } = require('../utils/http');
const requirementService = require('../services/requirementService');
const wbsService = require('../services/wbsService');
const changeRequestService = require('../services/changeRequestService');

module.exports = {
  listRequirements: asyncHandler(async (req, res) =>
    sendOk(res, await requirementService.listRequirements(req.query.projectId, req.query.status))
  ),
  createRequirement: asyncHandler(async (req, res) => sendOk(res, await requirementService.createRequirement(req.body), 201)),
  updateRequirement: asyncHandler(async (req, res) => sendOk(res, await requirementService.updateRequirement(req.params.id, req.body))),
  setPriority: asyncHandler(async (req, res) => sendOk(res, await requirementService.setPriority(req.params.id, req.body.priority))),
  approveRequirement: asyncHandler(async (req, res) => sendOk(res, await requirementService.approveRequirement(req.params.id))),
  rejectRequirement: asyncHandler(async (req, res) => sendOk(res, await requirementService.rejectRequirement(req.params.id))),
  approvedScope: asyncHandler(async (req, res) => sendOk(res, await requirementService.getApprovedScope(req.params.projectId))),

  listWbs: asyncHandler(async (req, res) => sendOk(res, await wbsService.listWbs(req.query.projectId))),
  wbsTree: asyncHandler(async (req, res) => sendOk(res, await wbsService.getWbsTree(req.params.projectId))),
  createWbs: asyncHandler(async (req, res) => sendOk(res, await wbsService.createWbsItem(req.body), 201)),
  updateWbs: asyncHandler(async (req, res) => sendOk(res, await wbsService.updateWbsItem(req.params.id, req.body))),

  listChangeRequests: asyncHandler(async (req, res) => sendOk(res, await changeRequestService.listChangeRequests(req.query.projectId))),
  getChangeRequest: asyncHandler(async (req, res) => sendOk(res, await changeRequestService.getChangeRequest(req.params.id))),
  createChangeRequest: asyncHandler(async (req, res) => sendOk(res, await changeRequestService.createChangeRequest(req.body), 201)),
  approveChangeRequest: asyncHandler(async (req, res) =>
    sendOk(res, await changeRequestService.approveChangeRequest(req.params.id, req.body && req.body.notes))
  ),
  rejectChangeRequest: asyncHandler(async (req, res) =>
    sendOk(res, await changeRequestService.rejectChangeRequest(req.params.id, req.body && req.body.notes))
  ),
};
