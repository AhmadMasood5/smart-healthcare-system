const { api, createProject, createTask, link, day } = require('./helpers');
const { analyzeSchedule } = require('../services/schedulingEngine');
const { addDays, toDay } = require('../utils/dates');
const m = require('../models');

describe('Module 3: Schedule and resource management', () => {
  test('TEST 9: task dependencies generate the correct schedule', async () => {
    const project = await createProject({ startDate: '2026-01-05' });
    const a = await createTask(project._id, 'Database Design', 5);
    const b = await createTask(project._id, 'Backend Development', 3);
    const c = await createTask(project._id, 'Frontend Integration', 4);
    const d = await createTask(project._id, 'Testing', 2);
    expect((await link(a._id, b._id)).status).toBe(201);
    expect((await link(a._id, c._id)).status).toBe(201);
    expect((await link(b._id, d._id)).status).toBe(201);
    expect((await link(c._id, d._id)).status).toBe(201);

    const schedule = (await api.get(`/api/schedule/${project._id}`).query({ reportDate: '2026-01-01' })).body.data;
    const t = Object.fromEntries(schedule.tasks.map((x) => [x.title, x]));
    expect([day(t['Database Design'].plannedStart), day(t['Database Design'].plannedEnd)]).toEqual(['2026-01-05', '2026-01-09']);
    expect([day(t['Backend Development'].plannedStart), day(t['Backend Development'].plannedEnd)]).toEqual(['2026-01-10', '2026-01-12']);
    expect([day(t['Frontend Integration'].plannedStart), day(t['Frontend Integration'].plannedEnd)]).toEqual(['2026-01-10', '2026-01-13']);
    // Testing waits for the later of its two predecessors.
    expect([day(t.Testing.plannedStart), day(t.Testing.plannedEnd)]).toEqual(['2026-01-14', '2026-01-15']);
    expect(day(schedule.summary.plannedCompletion)).toBe('2026-01-15');
    expect(schedule.criticalPath).toEqual(['T-001', 'T-003', 'T-004']);

    // Planned dates are persisted on the task records.
    expect(day((await m.Task.findById(d._id)).plannedStartDate)).toBe('2026-01-14');

    // Changing a duration re-runs the schedule.
    await api.put(`/api/tasks/${a._id}`).send({ estimatedDuration: 7 }).expect(200);
    expect(day((await m.Task.findById(d._id)).plannedStartDate)).toBe('2026-01-16');
  });

  test('TEST 10: circular, self, duplicate and cross-project dependencies are rejected', async () => {
    const project = await createProject();
    const a = await createTask(project._id, 'A', 2);
    const b = await createTask(project._id, 'B', 2);
    const c = await createTask(project._id, 'C', 2);
    await link(a._id, b._id);
    await link(b._id, c._id);

    const circular = await link(c._id, a._id);
    expect(circular.status).toBe(400);
    expect(circular.body.message).toMatch(/Circular dependency/);

    expect((await link(a._id, a._id)).status).toBe(400);
    expect((await link(a._id, b._id)).status).toBe(409);
    expect((await link(a._id, '64b7f0c2a1b2c3d4e5f60718')).status).toBe(400);
    expect((await link('bad-id', a._id)).status).toBe(400);

    const other = await createProject({ name: 'Other' });
    const x = await createTask(other._id, 'X', 2);
    const cross = await link(a._id, x._id);
    expect(cross.status).toBe(400);
    expect(cross.body.message).toMatch(/same project/);

    expect(await m.TaskDependency.countDocuments()).toBe(2);
  });

  test('TEST 11: task delays propagate through dependencies with float-aware completion impact', () => {
    const project = { startDate: new Date('2026-01-05'), deadline: new Date('2026-01-18') };
    const tasks = [
      { _id: 'A', taskId: 'T-A', title: 'A', estimatedDuration: 5, status: 'In Progress', progress: 40, actualStartDate: new Date('2026-01-05') },
      { _id: 'B', taskId: 'T-B', title: 'B', estimatedDuration: 3, status: 'Not Started', progress: 0 },
      { _id: 'C', taskId: 'T-C', title: 'C', estimatedDuration: 1, status: 'Not Started', progress: 0 },
      { _id: 'D', taskId: 'T-D', title: 'D', estimatedDuration: 2, status: 'Not Started', progress: 0 },
    ];
    const deps = [
      { predecessor: 'A', successor: 'B' },
      { predecessor: 'A', successor: 'C' },
      { predecessor: 'B', successor: 'D' },
      { predecessor: 'C', successor: 'D' },
    ];
    // Report on A's planned finish day with only 40% done: 3 days of work remain -> A ends 2 days late.
    const s = analyzeSchedule({ project, tasks, deps, reportDate: new Date('2026-01-09') });
    const t = Object.fromEntries(s.tasks.map((x) => [x.taskId, x]));

    expect(day(t['T-A'].forecastEnd)).toBe('2026-01-11');
    expect(t['T-A'].delayDays).toBe(2);
    expect(t['T-A'].delayCause).toBe('Progress behind plan');
    expect(t['T-A'].impactedTasks.map((x) => [x.taskId, x.shiftDays])).toEqual(
      expect.arrayContaining([['T-B', 2], ['T-C', 2], ['T-D', 2]])
    );

    expect(t['T-B'].delayDays).toBe(2);
    expect(t['T-B'].delayCause).toBe('Predecessor delay');
    expect(t['T-D'].delayDays).toBe(2);

    // C has 2 days of float, so its 2-day slip does not move the finish; B is critical and does.
    expect(t['T-C'].totalFloat).toBe(2);
    expect(t['T-C'].completionImpactDays).toBe(0);
    expect(t['T-B'].completionImpactDays).toBe(2);

    expect(day(s.summary.plannedCompletion)).toBe('2026-01-14');
    expect(day(s.summary.forecastCompletion)).toBe('2026-01-16');
    expect(s.summary.forecastVsDeadlineDays).toBe(-2); // still 2 days inside the approved deadline
    expect(s.summary.delayedTasks).toBe(4);
  });

  test('delays recorded through the API are detected and propagated', async () => {
    const start = addDays(toDay(new Date()), -10);
    const project = await createProject({ startDate: start.toISOString().slice(0, 10) });
    const a = await createTask(project._id, 'Backend', 5);
    const b = await createTask(project._id, 'Frontend', 3);
    await link(a._id, b._id);

    const upd = await api.put(`/api/tasks/${a._id}`).send({ actualStartDate: start.toISOString().slice(0, 10), progress: 20 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.status).toBe('In Progress');

    const s = (await api.get(`/api/schedule/${project._id}`)).body.data;
    const backend = s.tasks.find((t) => t.title === 'Backend');
    const frontend = s.tasks.find((t) => t.title === 'Frontend');
    expect(backend.isDelayed).toBe(true);
    expect(frontend.isDelayed).toBe(true);
    expect(frontend.delayCause).toBe('Predecessor delay');
    expect(s.summary.delayedTasks).toBe(2);
  });

  test('task validation: progress range, durations, references and finish-to-start rules', async () => {
    const project = await createProject({ startDate: '2026-01-05' });
    const other = await createProject({ name: 'Other' });
    const foreignMember = (await api.post('/api/team-members').send({ project: other._id, name: 'Outsider', role: 'QA Engineer', responsibilities: 'x' })).body.data;

    expect((await api.post('/api/tasks').send({ project: project._id, title: 'Bad', estimatedDuration: 0 })).status).toBe(400);
    expect((await api.post('/api/tasks').send({ project: project._id, title: '', estimatedDuration: 2 })).status).toBe(400);
    const crossMember = await api.post('/api/tasks').send({ project: project._id, title: 'X', estimatedDuration: 2, assignedTo: foreignMember._id });
    expect(crossMember.status).toBe(400);
    expect(crossMember.body.message).toMatch(/different project/);

    const a = await createTask(project._id, 'A', 2);
    const b = await createTask(project._id, 'B', 2);
    await link(a._id, b._id);

    expect((await api.put(`/api/tasks/${a._id}`).send({ progress: 150 })).status).toBe(400);
    expect((await api.put(`/api/tasks/${a._id}`).send({ status: 'In Progress' })).body.message).toMatch(/Actual start date is required/);
    // B cannot start while A is unfinished.
    const early = await api.put(`/api/tasks/${b._id}`).send({ status: 'In Progress', actualStartDate: '2026-01-07' });
    expect(early.status).toBe(400);
    expect(early.body.message).toMatch(/predecessor T-001/);

    const done = await api.put(`/api/tasks/${a._id}`).send({ status: 'Completed', actualStartDate: '2026-01-05', actualEndDate: '2026-01-06' });
    expect(done.status).toBe(200);
    expect(done.body.data.progress).toBe(100);
    const endBeforeStart = await api.put(`/api/tasks/${b._id}`).send({ status: 'Completed', actualStartDate: '2026-01-09', actualEndDate: '2026-01-08' });
    expect(endBeforeStart.status).toBe(400);
    expect((await api.put(`/api/tasks/${b._id}`).send({ status: 'In Progress', actualStartDate: '2026-01-07' })).status).toBe(200);
  });

  test('team members and assignments are listed with their tasks', async () => {
    const project = await createProject();
    const member = (await api.post('/api/team-members').send({ project: project._id, name: 'Bilal', role: 'Backend Developer', responsibilities: 'APIs' })).body.data;
    await createTask(project._id, 'API', 3, { assignedTo: member._id });
    const team = (await api.get('/api/team-members').query({ projectId: project._id })).body.data;
    expect(team[0].assignedTasks.map((t) => t.title)).toEqual(['API']);
    const sched = (await api.get(`/api/schedule/${project._id}`)).body.data;
    expect(sched.summary.assignedMembers).toBe(1);
  });
});
