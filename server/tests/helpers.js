const request = require('supertest');
const createApp = require('../app');
const { seedDatabase } = require('../seed/seedDatabase');
const m = require('../models');

const api = request(createApp());

const projectPayload = (overrides = {}) => ({
  name: 'Test Project',
  description: 'Project used by automated tests',
  objectives: ['Deliver on time'],
  scopeBoundaries: 'Test scope only',
  approvedBudget: 1000000,
  startDate: '2026-01-05',
  durationWeeks: 4,
  projectManager: 'Test PM',
  ...overrides,
});

async function createProject(overrides) {
  const res = await api.post('/api/projects').send(projectPayload(overrides));
  if (res.status !== 201) throw new Error(`Project fixture failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

async function createTask(projectId, title, estimatedDuration, extra = {}) {
  const res = await api.post('/api/tasks').send({ project: projectId, title, estimatedDuration, ...extra });
  if (res.status !== 201) throw new Error(`Task fixture failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

async function link(predecessor, successor) {
  return api.post('/api/task-dependencies').send({ predecessor, successor });
}

// Seeds the full case study and returns handy references.
async function seedCaseStudy() {
  const { projectId } = await seedDatabase();
  const cr = await m.ChangeRequest.findOne({ project: projectId, changeId: 'CR-001' });
  return { projectId: String(projectId), crId: String(cr._id) };
}

const day = (d) => new Date(d).toISOString().slice(0, 10);

module.exports = { api, projectPayload, createProject, createTask, link, seedCaseStudy, day };
