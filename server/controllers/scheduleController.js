const { sendOk, asyncHandler } = require('../utils/http');
const taskService = require('../services/taskService');
const scheduleService = require('../services/scheduleService');

module.exports = {
  listTasks: asyncHandler(async (req, res) => sendOk(res, await taskService.listTasks(req.query.projectId))),
  createTask: asyncHandler(async (req, res) => sendOk(res, await taskService.createTask(req.body), 201)),
  updateTask: asyncHandler(async (req, res) => sendOk(res, await taskService.updateTask(req.params.id, req.body))),

  listDependencies: asyncHandler(async (req, res) => sendOk(res, await taskService.listDependencies(req.query.projectId))),
  addDependency: asyncHandler(async (req, res) => sendOk(res, await taskService.addDependency(req.body), 201)),
  removeDependency: asyncHandler(async (req, res) => sendOk(res, await taskService.removeDependency(req.params.id))),

  getSchedule: asyncHandler(async (req, res) =>
    sendOk(res, await scheduleService.getProjectSchedule(req.params.projectId, req.query.reportDate))
  ),
};
