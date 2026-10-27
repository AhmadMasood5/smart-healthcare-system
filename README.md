# Smart Healthcare Project Management and Monitoring System

A MERN-stack (MongoDB, Express, React, Node.js) software project management system that manages the **development** of a healthcare software product for five hospitals: Patient Appointments, Laboratory Reports, Doctor Scheduling, Online Consultations and Hospital Billing.

It covers the six examination modules:

| # | Module | Page |
|---|--------|------|
| 1 | Project initiation & integration: charter, stakeholders, management plan, status, milestones, responsibilities, closure | Project Management |
| 2 | Scope management: requirements, prioritisation, approval, approved-scope rule, hierarchical WBS, change requests | Scope Management |
| 3 | Schedule & resources: team, tasks, finish-to-start dependencies, automatic scheduling, delay detection & propagation, Gantt chart | Schedule Management |
| 4 | Cost & EVM: planned costs, expenditures, PV / EV / AC / CPI / SPI, automatic warnings | Cost Management |
| 5 | Quality & risk: defects, quality checklists, risk register, 5×5 matrix, PDPC | Quality Management, Risk Management |
| 6 | Integration & reporting: cross-module updates, dashboard, integrated status report, validation, error handling | Dashboard |

---

## 1. Prerequisites

- Node.js 18 or newer (developed with Node 24)
- A **MongoDB deployment that supports transactions**. Change-request approval updates many collections in one multi-document transaction, which needs a replica set:
  - **MongoDB Atlas** (any tier, including the free tier): supported out of the box, or
  - a local **single-node replica set** (see section 3).

  A standalone `mongod` is rejected at startup with a clear message, so the app never runs approvals without transactions.

## 2. Installation

```bash
cd smart-healthcare-spm
npm install            # root tools (concurrently)
npm run install-all    # server + client dependencies
```

## 3. Configuration

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env`:

| Variable | Meaning |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string, e.g. `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/smart_healthcare_spm` |
| `PORT` | API port (default `5000`) |
| `CLIENT_ORIGIN` | Allowed CORS origin (default `http://localhost:5173`) |
| `DNS_SERVERS` | Optional, e.g. `8.8.8.8,1.1.1.1`. Set it if a `mongodb+srv://` URI fails with `querySrv ECONNREFUSED`, which happens when a local DNS proxy refuses SRV lookups |

`client/.env`: `VITE_API_URL=http://localhost:5000/api`

**Local replica set instead of Atlas.** This runs a second `mongod` on port 27018 and leaves any existing MongoDB service alone:

```bash
mkdir -p ./rsdata
"C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --replSet rs0 --port 27018 --dbpath ./rsdata
# in another terminal, once:
node -e "const {MongoClient}=require('./server/node_modules/mongodb');(async()=>{const c=await MongoClient.connect('mongodb://127.0.0.1:27018/?directConnection=true');await c.db('admin').command({replSetInitiate:{_id:'rs0',members:[{_id:0,host:'127.0.0.1:27018'}]}});await c.close()})()"
```

Then set `MONGODB_URI=mongodb://127.0.0.1:27018/smart_healthcare_spm?replicaSet=rs0`.

## 4. Seed the database

```bash
npm run seed           # idempotent: inserts only missing demo records, never duplicates or overwrites
npm run seed:reset     # deletes ONLY the demo project's records and re-creates them (before a demo)
```

The seed loads the full case study:
- the project (PKR 5,000,000, 16 weeks)
- 6 stakeholders, 7 team members and the management plan
- 5 approved requirements and a 21-item WBS
- 13 tasks with 18 dependencies, planned costs totalling exactly PKR 5,000,000, and a network spanning exactly 16 weeks
- actual progress and expenditures, and 7 milestones
- the **pending** change request *AI Diagnosis and Mobile Application* (+PKR 800,000, +3 weeks)
- the two critical defects, 10 checklist items, 4 risks and 6 PDPC branches

Dates are relative to the seeding day: the project starts on the Monday about 12 weeks earlier, so the demo always shows a project in week 12 of 16.

## 5. Run

```bash
npm run dev            # API on http://localhost:5000, React app on http://localhost:5173
```

Or separately: `npm run dev` inside `server/` and inside `client/`.

## 6. Tests

```bash
npm test               # backend (Jest + Supertest + MongoDB Memory Server replica set) then frontend (Vitest + RTL)
```

The first backend run downloads a MongoDB binary for MongoDB Memory Server (about 600 MB, cached afterwards). The tests do not need your `MONGODB_URI`.

### Expected vs actual results (run on 25 Oct 2026)

| Req. test | What it verifies | File | Expected | Actual |
|-----------|------------------|------|----------|--------|
| 1 | Project creation persists | `server/tests/project.test.js` | 201, document in MongoDB | Pass |
| 2 | Negative budget rejected | `project.test.js` | 400 with `approvedBudget` field error, nothing stored | Pass |
| 3 | Pending requirements excluded from scope | `scope.test.js` | not in approved scope; WBS link refused | Pass |
| 4 | Approved requirements enter scope | `scope.test.js` | in approved scope; rejected stays excluded | Pass |
| 5 | Budget 5,000,000 → 5,800,000 | `changeRequest.test.js` | 5,800,000 | Pass |
| 6 | Duration 16 → 19 weeks | `changeRequest.test.js` | 19, deadline = start + 133 − 1 days | Pass |
| 7 | Rejection keeps baseline | `changeRequest.test.js` | budget/duration/deadline/tasks unchanged | Pass |
| 8 | Duplicate approval | `changeRequest.test.js` | 409, impact applied once (also tested with 3 concurrent approvals) | Pass |
| 9 | Dependencies generate schedule | `schedule.test.js` | A 05–09 Jan, B 10–12, C 10–13, D 14–15 Jan | Pass |
| 10 | Circular dependency rejected | `schedule.test.js` | 400; self / duplicate / cross-project / invalid ids also rejected | Pass |
| 11 | Delay propagation | `schedule.test.js` | +2 days flows to successors; task with float has 0 completion impact | Pass |
| 12 | EVM PV 2.0M, EV 1.5M, AC 1.8M | `evm.test.js` | CPI 0.8333, SPI 0.75 (pure function **and** via API from real records) | Pass |
| 13 | Division by zero | `evm.test.js` | CPI/SPI `null` ("N/A"), HTTP 200 | Pass |
| 14 | Risk score 4 × 5 | `qualityRisk.test.js` | 20; client-supplied score ignored | Pass |
| 15 | Critical defect in dashboard | `qualityRisk.test.js` | unresolved critical = 2 | Pass |
| 16 | Resolving updates stats | `qualityRisk.test.js` | unresolved critical = 1 | Pass |
| 17 | Records persist | `project.test.js` | plan, milestone, status, closure stored | Pass |
| 18 | Integrated change approval | `changeRequest.test.js` | scope, WBS, tasks, dependencies, costs, milestone, plan, dashboard updated | Pass |
| 19 | Transaction failure rollback | `changeRequest.test.js` | injected failure → 500; nothing changed; later approval succeeds | Pass |
| 20 | Seeding does not duplicate | `seedReport.test.js` | identical counts on re-run; user edits preserved | Pass |
| 21 | Frontend form submits valid data | `client/src/tests/ProjectForm.test.jsx` | API called with typed payload | Pass |
| 22 | Frontend shows backend errors | `ProjectForm.test.jsx` | alert + field messages shown | Pass |
| 23 | Dashboard shows API values | `client/src/tests/Dashboard.test.jsx` | values rendered from mocked API | Pass |

Totals: **backend 40/40 passed (7 suites), frontend 6/6 passed (2 files).**

An additional browser end-to-end walkthrough of section 8 (Chrome via puppeteer-core) passed 27/27 checks against the running app.

## 7. Calculation rules

**Calendar convention (`server/utils/dates.js`).** All dates are UTC calendar days and every day counts (no weekends or holidays are excluded).
- A task of *D* days starting on day *S* occupies *S … S + D − 1*.
- A finish-to-start successor starts the day after its latest predecessor ends.
- Deadline = start date + weeks × 7 − 1. For example, 16 weeks from 03 Aug 2026 ends on 22 Nov 2026.

**Scheduling (`server/services/schedulingEngine.js`).**
- **Forward pass:** planned start = max(project start, latest predecessor end + 1). Planned dates are recomputed and stored whenever tasks, durations or dependencies change.
- **Backward pass:** gives each task's float against the planned completion and the approved deadline, and from that the critical path.
- **Forecast for completed tasks:** the actual dates.
- **Forecast for in-progress tasks:** finishes no earlier than the planned length from the actual start, and no earlier than *today + remaining work − 1*, where remaining work = duration × (100 − progress)%.
- **Forecast for not-started tasks:** starts at max(predecessor forecast end + 1, today).
- **Delay:** forecast end − planned end.
- **Impact on project completion:** delay − float. This is why a slipping task with float can leave the finish date unchanged.

**EVM (`server/services/evmEngine.js`).**
- PV is time-phased linearly over each task's planned days.
- EV = Σ planned cost × progress %.
- AC = expenditures dated on or before the reporting date.
- CPI = EV / AC and SPI = EV / PV. Either is `null` when its denominator is 0.
- Warning thresholds:
  - CPI or SPI below 1.0 is a warning; below 0.9 it is critical.
  - Actual expenditure above the approved budget is a budget overrun.
  - Planned costs above the budget are also flagged.

**Overall progress** = EV ÷ total planned cost, i.e. a cost-weighted % complete.

**Risk** score = likelihood × impact. Priority: High ≥ 15, Medium 8–14, Low ≤ 7.

## 8. Demonstration procedure

1. `npm run seed:reset`, then `npm run dev`, and open http://localhost:5173. The Dashboard shows the project with **PKR 5,000,000** and **16 weeks**.
2. **Scope Management → Approved Scope**: 5 approved healthcare requirements.
3. **Scope Management → Work Breakdown Structure**: the interactive tree (expand/collapse, edit, add child).
4. **Schedule Management**: the tasks, assignments and dependencies, plus the **Gantt Chart** tab (delays shown in red, milestones M1–M7, today and deadline lines) and the **Delay Analysis** tab.
5. **Scope Management → Change Requests**: *AI Diagnosis and Mobile Application* shows **Pending**, PKR 800,000, 3 weeks.
6. Click **Approve** to open the confirmation, which previews the before/after values, then click **Approve change**. The navbar now shows **PKR 5,800,000 / 19 weeks / deadline 13 Dec 2026**, and:
   - **Approved Scope** includes both new requirements
   - **Schedule** shows T-014 / T-015 between Integration and Testing
   - **Project Management → Management Plan** shows version 2 with the new baseline
7. **Cost Management**: PV, EV, AC, CPI, SPI, with cost and schedule warnings.
8. **Quality Management**: *Appointment Double Booking* and *Patient Record Management Failure*, both Critical. Set one to Resolved and the counts update.
9. **Risk Management**: the **Prioritization Matrix** and **PDPC** tabs.
10. **Dashboard**: every value reflects the latest database state. Click **Generate Report** for the integrated status report.

## 9. Screenshots

To capture screenshots of each module, follow the demonstration procedure in section 8 with the app running. On Windows, use **Win + Shift + S** or the browser's full-page capture (DevTools → Ctrl + Shift + P → "Capture full size screenshot").

Suggested captures:
- the dashboard before and after the change approval
- scope requirements, approved scope and the WBS
- tasks, the Gantt chart and the delay analysis
- the change request while pending and after approval
- the EVM page
- defects and quality checklists
- the risk matrix and the PDPC

## 10. API overview

All responses use `{ success: true, data }` or `{ success: false, message, errors: [{ field, message }] }`. Status codes:
- 400: validation error
- 404: record not found
- 409: duplicate or conflicting action, e.g. a second approval
- 500: unexpected error, returned without a stack trace

| Area | Endpoints |
|------|-----------|
| Projects | `GET/POST /api/projects`, `GET/PUT /api/projects/:id` |
| Plan / closure | `GET /api/plans?projectId=`, `POST /api/plans`, `PUT /api/plans/:id`; same for `/api/closures` |
| Stakeholders, team, milestones | `/api/stakeholders`, `/api/team-members`, `/api/milestones` (GET `?projectId=`, POST, PUT `/:id`) |
| Requirements | `GET/POST /api/requirements`, `PUT /:id`, `PATCH /:id/priority`, `POST /:id/approve`, `POST /:id/reject`, `GET /api/requirements/scope/:projectId` |
| WBS | `GET /api/wbs?projectId=`, `GET /api/wbs/tree/:projectId`, `POST /api/wbs`, `PUT /api/wbs/:id` |
| Change requests | `GET/POST /api/change-requests`, `GET /:id`, `POST /:id/approve`, `POST /:id/reject` |
| Tasks & scheduling | `GET/POST /api/tasks`, `PUT /api/tasks/:id`, `GET/POST /api/task-dependencies`, `DELETE /:id`, `GET /api/schedule/:projectId` |
| Cost | `/api/activity-costs`, `/api/expenditures` (CRUD), `GET /api/evm/:projectId?reportDate=` |
| Quality | `GET/POST /api/defects`, `PUT /:id`, `GET /api/defects/stats/:projectId`, `/api/quality-checklists` (CRUD) |
| Risk | `GET/POST /api/risks`, `PUT /:id`, `GET /api/risks/matrix/:projectId`, `/api/risk-responses` (CRUD), `GET /api/risk-responses/pdpc/:projectId` |
| Integration | `GET /api/dashboard/:projectId`, `GET /api/reports/:projectId` |

## 11. Project structure

```
server/  config/ (DB connection + transaction check), models/ (17 Mongoose models), services/ (business logic,
         scheduling & EVM engines), controllers/, routes/, middleware/ (error handling), seed/, tests/
client/  src/components/ (Layout, Sidebar, Navbar, StatusBadge, DataTable, ConfirmDialog, GanttChart, RiskMatrix, TeamPanel, ui),
         src/pages/ (7 pages), src/services/api.js (Axios), src/context/, src/utils/, src/tests/
```

## 12. Known limitations

- There is no authentication, by design: the examination scope excludes login and roles.
- The schedule uses calendar days. Weekends and holidays are not excluded.
- Resource levelling (detecting a person double-booked across parallel tasks) is not performed. Assignments are recorded and counted.
- Task and WBS deletion is not provided, to keep dependencies, costs and defect references consistent. Dependencies, expenditures, planned costs, checklist items, stakeholders and PDPC branches can be deleted.
