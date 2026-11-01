// Cross-document consistency checks shared by all services.
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { Project } = require('../models');

function assertObjectId(id, label) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError(400, `${label} is missing or invalid`);
  }
}

async function requireProject(projectId, session = null) {
  assertObjectId(projectId, 'Project reference');
  const project = await Project.findById(projectId).session(session);
  if (!project) throw new AppError(404, 'Project not found');
  return project;
}

// Ensures a referenced document exists and belongs to the same project.
async function assertSameProject(Model, id, projectId, label, session = null) {
  if (id === null || id === undefined || id === '') return null;
  assertObjectId(id, `${label} reference`);
  const doc = await Model.findById(id).session(session);
  if (!doc) throw new AppError(400, `${label} not found`);
  if (String(doc.project) !== String(projectId)) {
    throw new AppError(400, `${label} belongs to a different project`);
  }
  return doc;
}

async function findOr404(Model, id, label, session = null) {
  assertObjectId(id, `${label} id`);
  const doc = await Model.findById(id).session(session);
  if (!doc) throw new AppError(404, `${label} not found`);
  return doc;
}

// Generates the next sequential code (e.g. REQ-006) for a project.
async function nextCode(Model, field, prefix, projectId, session = null) {
  const docs = await Model.find({ project: projectId, [field]: new RegExp(`^${prefix}-\\d+$`) })
    .select(field)
    .session(session)
    .lean();
  const max = docs.reduce((m, d) => Math.max(m, parseInt(d[field].split('-')[1], 10)), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

module.exports = { assertObjectId, requireProject, assertSameProject, findOr404, nextCode };
