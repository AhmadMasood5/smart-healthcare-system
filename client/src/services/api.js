import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Unwrap { success, data } and turn API failures into Errors with field-level details.
http.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    const body = error.response && error.response.data;
    const err = new Error(
      (body && body.message) || (error.response ? `Request failed (${error.response.status})` : 'Cannot reach the API server. Make sure the backend is running.')
    );
    err.status = error.response ? error.response.status : 0;
    err.fieldErrors = (body && body.errors) || [];
    return Promise.reject(err);
  }
);

const crud = (path) => ({
  list: (projectId) => http.get(path, { params: { projectId } }),
  create: (data) => http.post(path, data),
  update: (id, data) => http.put(`${path}/${id}`, data),
  remove: (id) => http.delete(`${path}/${id}`),
});

export const api = {
  projects: {
    list: () => http.get('/projects'),
    get: (id) => http.get(`/projects/${id}`),
    create: (data) => http.post('/projects', data),
    update: (id, data) => http.put(`/projects/${id}`, data),
  },
  plans: {
    get: (projectId) => http.get('/plans', { params: { projectId } }),
    create: (data) => http.post('/plans', data),
    update: (id, data) => http.put(`/plans/${id}`, data),
  },
  closures: {
    get: (projectId) => http.get('/closures', { params: { projectId } }),
    create: (data) => http.post('/closures', data),
    update: (id, data) => http.put(`/closures/${id}`, data),
  },
  stakeholders: crud('/stakeholders'),
  teamMembers: crud('/team-members'),
  milestones: crud('/milestones'),

  requirements: {
    list: (projectId, status) => http.get('/requirements', { params: { projectId, status } }),
    create: (data) => http.post('/requirements', data),
    update: (id, data) => http.put(`/requirements/${id}`, data),
    setPriority: (id, priority) => http.patch(`/requirements/${id}/priority`, { priority }),
    approve: (id) => http.post(`/requirements/${id}/approve`),
    reject: (id) => http.post(`/requirements/${id}/reject`),
    scope: (projectId) => http.get(`/requirements/scope/${projectId}`),
  },
  wbs: {
    list: (projectId) => http.get('/wbs', { params: { projectId } }),
    tree: (projectId) => http.get(`/wbs/tree/${projectId}`),
    create: (data) => http.post('/wbs', data),
    update: (id, data) => http.put(`/wbs/${id}`, data),
  },
  changeRequests: {
    list: (projectId) => http.get('/change-requests', { params: { projectId } }),
    create: (data) => http.post('/change-requests', data),
    approve: (id, notes) => http.post(`/change-requests/${id}/approve`, { notes }),
    reject: (id, notes) => http.post(`/change-requests/${id}/reject`, { notes }),
  },

  tasks: {
    list: (projectId) => http.get('/tasks', { params: { projectId } }),
    create: (data) => http.post('/tasks', data),
    update: (id, data) => http.put(`/tasks/${id}`, data),
  },
  dependencies: {
    list: (projectId) => http.get('/task-dependencies', { params: { projectId } }),
    create: (data) => http.post('/task-dependencies', data),
    remove: (id) => http.delete(`/task-dependencies/${id}`),
  },
  schedule: (projectId) => http.get(`/schedule/${projectId}`),

  activityCosts: crud('/activity-costs'),
  expenditures: crud('/expenditures'),
  evm: (projectId, reportDate) => http.get(`/evm/${projectId}`, { params: { reportDate: reportDate || undefined } }),

  defects: { ...crud('/defects'), stats: (projectId) => http.get(`/defects/stats/${projectId}`) },
  checklists: { ...crud('/quality-checklists'), summary: (projectId) => http.get(`/quality-checklists/summary/${projectId}`) },
  risks: { ...crud('/risks'), matrix: (projectId) => http.get(`/risks/matrix/${projectId}`) },
  riskResponses: { ...crud('/risk-responses'), pdpc: (projectId) => http.get(`/risk-responses/pdpc/${projectId}`) },

  dashboard: (projectId) => http.get(`/dashboard/${projectId}`),
  report: (projectId) => http.get(`/reports/${projectId}`),
};

export default api;
