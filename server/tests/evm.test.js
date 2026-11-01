const { api, createProject, createTask, link } = require('./helpers');
const { calculateEvmIndicators, plannedFraction, buildCostWarnings } = require('../services/evmEngine');

describe('Module 4: Cost management and EVM', () => {
  test('TEST 12: CPI and SPI from PV=2,000,000, EV=1,500,000, AC=1,800,000', () => {
    const r = calculateEvmIndicators({ pv: 2000000, ev: 1500000, ac: 1800000 });
    expect(r.cpi).toBeCloseTo(0.8333, 4);
    expect(r.spi).toBe(0.75);
    expect(r.cpiStatus).toMatch(/Poor cost performance/);
    expect(r.spiStatus).toBe('Behind schedule');
  });

  test('TEST 12 (API): backend derives PV, EV and AC from tasks, costs and expenditures', async () => {
    const project = await createProject({ startDate: '2026-01-05', approvedBudget: 3000000 });
    const a = await createTask(project._id, 'Development', 10); // planned Jan 05 - Jan 14
    const b = await createTask(project._id, 'Testing', 10); // planned Jan 15 - Jan 24
    await link(a._id, b._id);
    await api.post('/api/activity-costs').send({ project: project._id, task: a._id, plannedCost: 2000000 }).expect(201);
    await api.post('/api/activity-costs').send({ project: project._id, task: b._id, plannedCost: 1000000 }).expect(201);
    await api.put(`/api/tasks/${a._id}`).send({ actualStartDate: '2026-01-05', progress: 75 }).expect(200);
    await api.post('/api/expenditures').send({ project: project._id, task: a._id, amount: 1800000, date: '2026-01-10' }).expect(201);

    const evm = (await api.get(`/api/evm/${project._id}`).query({ reportDate: '2026-01-14' })).body.data;
    expect(evm.pv).toBe(2000000);
    expect(evm.ev).toBe(1500000);
    expect(evm.ac).toBe(1800000);
    expect(evm.cpi).toBeCloseTo(0.8333, 4);
    expect(evm.spi).toBe(0.75);
    expect(evm.totalPlannedCost).toBe(3000000);
    expect(evm.remainingBudget).toBe(1200000);
    expect(evm.warnings.map((w) => w.type)).toEqual(expect.arrayContaining(['COST_PERFORMANCE', 'SCHEDULE_PERFORMANCE']));

    // Time-phased PV: halfway through Testing adds 50% of its cost.
    const later = (await api.get(`/api/evm/${project._id}`).query({ reportDate: '2026-01-19' })).body.data;
    expect(later.pv).toBe(2500000);
  });

  test('TEST 13: division by zero is handled safely', async () => {
    const r = calculateEvmIndicators({ pv: 0, ev: 0, ac: 0 });
    expect(r.cpi).toBeNull();
    expect(r.spi).toBeNull();
    expect(r.cpiStatus).toMatch(/Not available/);

    const project = await createProject();
    const res = await api.get(`/api/evm/${project._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ pv: 0, ev: 0, ac: 0, cpi: null, spi: null });
    expect(res.body.data.warnings).toEqual([]);
  });

  test('planned fraction is linear across planned calendar days', () => {
    const s = new Date('2026-01-05');
    const e = new Date('2026-01-14');
    expect(plannedFraction(s, e, '2026-01-04')).toBe(0);
    expect(plannedFraction(s, e, '2026-01-09')).toBe(0.5);
    expect(plannedFraction(s, e, '2026-01-14')).toBe(1);
  });

  test('budget overrun warning when expenditure exceeds approved budget', () => {
    const w = buildCostWarnings({ approvedBudget: 100, totalPlannedCost: 100, actualExpenditure: 150, cpi: 1, spi: 1 });
    expect(w.map((x) => x.type)).toEqual(['BUDGET_OVERRUN']);
  });

  test('negative costs and expenditures are rejected; planned cost is one per task', async () => {
    const project = await createProject({ startDate: '2026-01-05' });
    const a = await createTask(project._id, 'A', 5);
    expect((await api.post('/api/activity-costs').send({ project: project._id, task: a._id, plannedCost: -5 })).status).toBe(400);
    expect((await api.post('/api/expenditures').send({ project: project._id, task: a._id, amount: -10, date: '2026-01-06' })).status).toBe(400);
    expect((await api.post('/api/expenditures').send({ project: project._id, task: a._id, amount: 10, date: '2025-12-01' })).status).toBe(400);
    await api.post('/api/activity-costs').send({ project: project._id, task: a._id, plannedCost: 100 }).expect(201);
    expect((await api.post('/api/activity-costs').send({ project: project._id, task: a._id, plannedCost: 100 })).status).toBe(409);
  });
});
