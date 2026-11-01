const express = require('express');
const project = require('../controllers/projectController');
const scope = require('../controllers/scopeController');
const schedule = require('../controllers/scheduleController');
const cost = require('../controllers/costController');
const qr = require('../controllers/qualityRiskController');
const dashboard = require('../controllers/dashboardController');

const router = express.Router();

function mountCrud(path, ctrl, { remove = false } = {}) {
  router.get(path, ctrl.list);
  router.post(path, ctrl.create);
  router.put(`${path}/:id`, ctrl.update);
  if (remove) router.delete(`${path}/:id`, ctrl.remove);
}

// Module 1: Project initiation & integration
router.get('/projects', project.listProjects);
router.post('/projects', project.createProject);
router.get('/projects/:id', project.getProject);
router.put('/projects/:id', project.updateProject);
router.get('/plans', project.getPlan);
router.post('/plans', project.createPlan);
router.put('/plans/:id', project.updatePlan);
router.get('/closures', project.getClosure);
router.post('/closures', project.createClosure);
router.put('/closures/:id', project.updateClosure);
mountCrud('/stakeholders', project.stakeholders, { remove: true });
mountCrud('/team-members', project.teamMembers);
mountCrud('/milestones', project.milestones);

// Module 2: Scope management & WBS
router.get('/requirements', scope.listRequirements);
router.post('/requirements', scope.createRequirement);
router.get('/requirements/scope/:projectId', scope.approvedScope);
router.put('/requirements/:id', scope.updateRequirement);
router.patch('/requirements/:id/priority', scope.setPriority);
router.post('/requirements/:id/approve', scope.approveRequirement);
router.post('/requirements/:id/reject', scope.rejectRequirement);
router.get('/wbs', scope.listWbs);
router.get('/wbs/tree/:projectId', scope.wbsTree);
router.post('/wbs', scope.createWbs);
router.put('/wbs/:id', scope.updateWbs);
router.get('/change-requests', scope.listChangeRequests);
router.post('/change-requests', scope.createChangeRequest);
router.get('/change-requests/:id', scope.getChangeRequest);
router.post('/change-requests/:id/approve', scope.approveChangeRequest);
router.post('/change-requests/:id/reject', scope.rejectChangeRequest);

// Module 3: Schedule & resources
router.get('/tasks', schedule.listTasks);
router.post('/tasks', schedule.createTask);
router.put('/tasks/:id', schedule.updateTask);
router.get('/task-dependencies', schedule.listDependencies);
router.post('/task-dependencies', schedule.addDependency);
router.delete('/task-dependencies/:id', schedule.removeDependency);
router.get('/schedule/:projectId', schedule.getSchedule);

// Module 4: Cost & EVM
mountCrud('/activity-costs', cost.activityCosts, { remove: true });
mountCrud('/expenditures', cost.expenditures, { remove: true });
router.get('/evm/:projectId', cost.getEvm);

// Module 5: Quality & risk
router.get('/defects/stats/:projectId', qr.defectStats);
mountCrud('/defects', qr.defects);
router.get('/quality-checklists/summary/:projectId', qr.checklistSummary);
mountCrud('/quality-checklists', qr.checklists, { remove: true });
router.get('/risks/matrix/:projectId', qr.riskMatrix);
mountCrud('/risks', qr.risks);
router.get('/risk-responses/pdpc/:projectId', qr.pdpc);
mountCrud('/risk-responses', qr.riskResponses, { remove: true });

// Module 6: Integration & reporting
router.get('/dashboard/:projectId', dashboard.getDashboard);
router.get('/reports/:projectId', dashboard.getReport);

module.exports = router;
