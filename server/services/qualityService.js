const { Defect, QualityChecklist, TeamMember, Task, WBSItem } = require('../models');
const { createCrudService } = require('./crudService');
const { requireProject } = require('./referenceService');

const UNRESOLVED = ['Open', 'In Progress'];
const SEVERITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const defects = createCrudService(Defect, {
  label: 'Defect',
  fields: ['title', 'description', 'severity', 'status', 'assignedTo', 'relatedTask', 'relatedDeliverable'],
  refs: {
    assignedTo: [TeamMember, 'Assigned team member'],
    relatedTask: [Task, 'Related task'],
    relatedDeliverable: [WBSItem, 'Related deliverable'],
  },
  code: { field: 'defectId', prefix: 'DEF' },
  sort: { defectId: 1 },
  populate: [
    { path: 'assignedTo', select: 'name role' },
    { path: 'relatedTask', select: 'taskId title' },
    { path: 'relatedDeliverable', select: 'title type' },
  ],
});

const checklists = createCrudService(QualityChecklist, {
  label: 'Checklist item',
  fields: ['deliverable', 'item', 'inspectionResult', 'status', 'remarks'],
  sort: { deliverable: 1, createdAt: 1 },
});

function summariseDefects(list) {
  const unresolved = list.filter((d) => UNRESOLVED.includes(d.status));
  const count = (arr, key, values) => Object.fromEntries(values.map((v) => [v, arr.filter((d) => d[key] === v).length]));
  return {
    total: list.length,
    unresolved: unresolved.length,
    resolved: list.length - unresolved.length,
    unresolvedCritical: unresolved.filter((d) => d.severity === 'Critical').length,
    bySeverity: count(list, 'severity', ['Critical', 'High', 'Medium', 'Low']),
    byStatus: count(list, 'status', ['Open', 'In Progress', 'Resolved', 'Closed']),
    unresolvedCriticalDefects: unresolved
      .filter((d) => d.severity === 'Critical')
      .map((d) => ({ _id: d._id, defectId: d.defectId, title: d.title, status: d.status })),
  };
}

async function getDefectStats(projectId) {
  await requireProject(projectId);
  const list = await Defect.find({ project: projectId }).lean();
  return summariseDefects(list);
}

async function listDefects(projectId) {
  const list = await defects.list(projectId);
  return list.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.defectId.localeCompare(b.defectId));
}

async function getChecklistSummary(projectId) {
  await requireProject(projectId);
  const items = await QualityChecklist.find({ project: projectId }).lean();
  return {
    total: items.length,
    passed: items.filter((i) => i.inspectionResult === 'Pass').length,
    failed: items.filter((i) => i.inspectionResult === 'Fail').length,
    notInspected: items.filter((i) => i.inspectionResult === 'Not Inspected').length,
  };
}

module.exports = { defects, checklists, listDefects, getDefectStats, summariseDefects, getChecklistSummary, UNRESOLVED };
