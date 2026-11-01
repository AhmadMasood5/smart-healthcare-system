const { sendOk, asyncHandler } = require('../utils/http');
const projectService = require('../services/projectService');
const teamService = require('../services/teamService');
const { crudController } = require('./crudController');

module.exports = {
  listProjects: asyncHandler(async (req, res) => sendOk(res, await projectService.listProjects())),
  getProject: asyncHandler(async (req, res) => sendOk(res, await projectService.getProject(req.params.id))),
  createProject: asyncHandler(async (req, res) => sendOk(res, await projectService.createProject(req.body), 201)),
  updateProject: asyncHandler(async (req, res) => sendOk(res, await projectService.updateProject(req.params.id, req.body))),

  getPlan: asyncHandler(async (req, res) => sendOk(res, await projectService.getPlan(req.query.projectId))),
  createPlan: asyncHandler(async (req, res) => sendOk(res, await projectService.createPlan(req.body), 201)),
  updatePlan: asyncHandler(async (req, res) => sendOk(res, await projectService.updatePlan(req.params.id, req.body))),

  getClosure: asyncHandler(async (req, res) => sendOk(res, await projectService.getClosure(req.query.projectId))),
  createClosure: asyncHandler(async (req, res) => sendOk(res, await projectService.createClosure(req.body), 201)),
  updateClosure: asyncHandler(async (req, res) => sendOk(res, await projectService.updateClosure(req.params.id, req.body))),

  stakeholders: crudController(teamService.stakeholders),
  teamMembers: crudController(teamService.teamMembers, { list: teamService.listTeamWithAssignments }),
  milestones: crudController(teamService.milestones),
};
