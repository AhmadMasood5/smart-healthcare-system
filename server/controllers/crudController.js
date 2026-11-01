const { sendOk, asyncHandler } = require('../utils/http');

// Standard handlers for a createCrudService() instance. List endpoints take ?projectId=.
function crudController(service, { list } = {}) {
  return {
    list: asyncHandler(async (req, res) => sendOk(res, await (list || service.list)(req.query.projectId))),
    get: asyncHandler(async (req, res) => sendOk(res, await service.getById(req.params.id))),
    create: asyncHandler(async (req, res) => sendOk(res, await service.create(req.body), 201)),
    update: asyncHandler(async (req, res) => sendOk(res, await service.update(req.params.id, req.body))),
    remove: asyncHandler(async (req, res) => sendOk(res, await service.remove(req.params.id))),
  };
}

module.exports = { crudController };
