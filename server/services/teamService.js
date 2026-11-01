// Stakeholders, team members/responsibilities and milestones.
const { Stakeholder, TeamMember, Milestone, Task } = require('../models');
const { createCrudService } = require('./crudService');
const { requireProject } = require('./referenceService');

const stakeholders = createCrudService(Stakeholder, {
  label: 'Stakeholder',
  fields: ['name', 'role', 'interest', 'influence'],
});

const teamMembers = createCrudService(TeamMember, {
  label: 'Team member',
  fields: ['name', 'role', 'responsibilities'],
});

const milestones = createCrudService(Milestone, {
  label: 'Milestone',
  fields: ['title', 'description', 'plannedDate', 'actualCompletionDate', 'completionStatus', 'linkedTask'],
  refs: { linkedTask: [Task, 'Linked task'] },
  sort: { plannedDate: 1 },
  populate: [{ path: 'linkedTask', select: 'taskId title plannedEndDate' }],
  validate: async (doc) => {
    if (doc.actualCompletionDate === '') doc.actualCompletionDate = null;
    // A task-linked milestone falls due when its task is scheduled to finish.
    if (doc.linkedTask) {
      const task = await Task.findById(doc.linkedTask).lean();
      if (task && task.plannedEndDate) doc.plannedDate = task.plannedEndDate;
    }
  },
});

// Team members with the tasks currently assigned to them (responsibility assignment view).
async function listTeamWithAssignments(projectId) {
  await requireProject(projectId);
  const [members, tasks] = await Promise.all([
    TeamMember.find({ project: projectId }).sort({ createdAt: 1 }).lean(),
    Task.find({ project: projectId, assignedTo: { $ne: null } }).select('taskId title status progress assignedTo').lean(),
  ]);
  return members.map((m) => ({
    ...m,
    assignedTasks: tasks
      .filter((t) => String(t.assignedTo) === String(m._id))
      .map((t) => ({ _id: t._id, taskId: t.taskId, title: t.title, status: t.status, progress: t.progress })),
  }));
}

module.exports = { stakeholders, teamMembers, milestones, listTeamWithAssignments };
