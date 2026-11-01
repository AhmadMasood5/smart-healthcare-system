// Case-study demonstration data. Days are 1-based offsets from the project start date
// (day 1 = start date), so the dataset stays internally consistent whenever it is seeded.
module.exports = {
  // The project starts on the Monday on/before (seed date - 83 days): the seed date falls in week 12 of 16.
  startOffsetDays: 83,

  project: {
    name: 'Smart Healthcare Software Development Project',
    description:
      'Development of an integrated healthcare software platform for five partner hospitals covering patient appointments, laboratory reports, doctor scheduling, online consultations and hospital billing.',
    objectives: [
      'Deliver the five core healthcare modules to all 5 hospitals',
      'Complete the project within the approved budget of PKR 5,000,000',
      'Complete the project within the approved 16-week schedule',
      'Release with zero unresolved critical defects',
    ],
    scopeBoundaries:
      'In scope: Patient Appointment Management, Laboratory Reports, Doctor Scheduling, Online Consultations, Hospital Billing for 5 hospitals. Out of scope: hospital hardware procurement, data migration from legacy paper records, and any feature not approved through change control.',
    approvedBudget: 5000000,
    durationWeeks: 16,
    projectManager: 'Ayesha Khan',
    status: 'In Progress',
  },

  stakeholders: [
    { name: 'Hospital Management Board', role: 'Project Sponsor', interest: 'Approves budget, scope and change requests', influence: 'High' },
    { name: 'Partner Hospital Administrators (5)', role: 'Client Representatives', interest: 'Operational fit of the software in each hospital', influence: 'High' },
    { name: 'Doctors and Medical Staff', role: 'End Users', interest: 'Scheduling, consultations and patient records', influence: 'Medium' },
    { name: 'Laboratory Department', role: 'End Users', interest: 'Accurate laboratory report management', influence: 'Medium' },
    { name: 'Hospital Billing Department', role: 'End Users', interest: 'Correct invoicing and payments records', influence: 'Medium' },
    { name: 'Software Company Leadership', role: 'Performing Organization', interest: 'Profitability and delivery quality', influence: 'High' },
  ],

  plan: {
    scopePlan:
      'Scope is defined by approved requirements only. New requirements enter through change requests and are added to the WBS after approval by the Hospital Management Board.',
    schedulePlan:
      'Tasks are estimated in calendar days and linked with finish-to-start dependencies. The system computes planned dates automatically, tracks actual progress weekly and flags delays against the approved deadline.',
    costPlan:
      'Each activity has a planned cost; the total must stay within the approved budget. Expenditures are recorded against tasks and performance is monitored with EVM (PV, EV, AC, CPI, SPI) with warnings below 1.0.',
    qualityPlan:
      'Each deliverable is inspected with a testing checklist. Defects are logged with severity; no release is allowed while critical defects remain unresolved.',
  },

  team: [
    { name: 'Ayesha Khan', role: 'Project Manager', responsibilities: 'Planning, stakeholder communication, change control, progress and cost monitoring' },
    { name: 'Bilal Ahmed', role: 'Backend Developer', responsibilities: 'System design, core REST APIs, doctor scheduling backend' },
    { name: 'Hamza Iqbal', role: 'Backend Developer', responsibilities: 'Appointment and billing module business logic' },
    { name: 'Sara Malik', role: 'Frontend Developer', responsibilities: 'Core user interface and online consultation screens' },
    { name: 'Usman Tariq', role: 'Frontend Developer', responsibilities: 'Laboratory report screens and system integration' },
    { name: 'Fatima Noor', role: 'Database Developer', responsibilities: 'Database design, data integrity, backups and deployment' },
    { name: 'Zainab Hussain', role: 'QA Engineer', responsibilities: 'Test planning, quality checklists and defect verification' },
  ],

  requirements: [
    { reqId: 'REQ-001', title: 'Patient Appointment Management', description: 'Patients can book, reschedule and cancel appointments with available doctors.', priority: 'Critical' },
    { reqId: 'REQ-002', title: 'Laboratory Reports', description: 'Laboratory staff upload test results that doctors and patients can view securely.', priority: 'High' },
    { reqId: 'REQ-003', title: 'Doctor Scheduling', description: 'Hospitals manage doctor duty rosters and consultation slots.', priority: 'High' },
    { reqId: 'REQ-004', title: 'Online Consultations', description: 'Doctors conduct remote consultations with patients.', priority: 'Medium' },
    { reqId: 'REQ-005', title: 'Hospital Billing', description: 'Generate invoices for consultations, tests and services.', priority: 'High' },
  ],

  // [title, type, parentTitle, requirementReqId]
  wbs: [
    ['Smart Healthcare Project', 'Deliverable', null, null],
    ['Planning', 'Deliverable', 'Smart Healthcare Project', null],
    ['Requirements Analysis', 'Work Package', 'Planning', null],
    ['System Design', 'Work Package', 'Planning', null],
    ['Database Design', 'Work Package', 'Planning', null],
    ['Development', 'Deliverable', 'Smart Healthcare Project', null],
    ['Core Platform', 'Sub-deliverable', 'Development', null],
    ['Backend Development', 'Work Package', 'Core Platform', null],
    ['Frontend Development', 'Work Package', 'Core Platform', null],
    ['Healthcare Modules', 'Sub-deliverable', 'Development', null],
    ['Appointment Module', 'Work Package', 'Healthcare Modules', 'REQ-001'],
    ['Laboratory Module', 'Work Package', 'Healthcare Modules', 'REQ-002'],
    ['Doctor Scheduling', 'Work Package', 'Healthcare Modules', 'REQ-003'],
    ['Online Consultation', 'Work Package', 'Healthcare Modules', 'REQ-004'],
    ['Billing Module', 'Work Package', 'Healthcare Modules', 'REQ-005'],
    ['System Integration', 'Work Package', 'Development', null],
    ['Testing', 'Deliverable', 'Smart Healthcare Project', null],
    ['Functional Testing', 'Work Package', 'Testing', null],
    ['Defect Resolution', 'Work Package', 'Testing', null],
    ['Deployment', 'Deliverable', 'Smart Healthcare Project', null],
    ['Final Deployment', 'Work Package', 'Deployment', null],
  ],

  // Planned costs total PKR 5,000,000; the dependency network spans exactly 112 days (16 weeks).
  // actual: [startDay, endDay|null]; spend: [amount, day]
  tasks: [
    { taskId: 'T-001', title: 'Requirements Analysis', wbs: 'Requirements Analysis', member: 'Ayesha Khan', duration: 10, preds: [], cost: 250000, actual: [1, 10], progress: 100, spend: [260000, 10] },
    { taskId: 'T-002', title: 'System Design', wbs: 'System Design', member: 'Bilal Ahmed', duration: 11, preds: ['T-001'], cost: 350000, actual: [11, 23], progress: 100, spend: [370000, 23] },
    { taskId: 'T-003', title: 'Database Design', wbs: 'Database Design', member: 'Fatima Noor', duration: 10, preds: ['T-002'], cost: 300000, actual: [24, 33], progress: 100, spend: [310000, 33] },
    { taskId: 'T-004', title: 'Backend Development', wbs: 'Backend Development', member: 'Bilal Ahmed', duration: 14, preds: ['T-003'], cost: 700000, actual: [34, 49], progress: 100, spend: [760000, 49] },
    { taskId: 'T-005', title: 'Frontend Development', wbs: 'Frontend Development', member: 'Sara Malik', duration: 14, preds: ['T-002'], cost: 550000, actual: [24, 40], progress: 100, spend: [560000, 40] },
    { taskId: 'T-006', title: 'Appointment Module', wbs: 'Appointment Module', member: 'Hamza Iqbal', duration: 12, preds: ['T-004', 'T-005'], cost: 400000, actual: [50, 63], progress: 100, spend: [430000, 63] },
    { taskId: 'T-007', title: 'Laboratory Reports Module', wbs: 'Laboratory Module', member: 'Usman Tariq', duration: 10, preds: ['T-004', 'T-005'], cost: 300000, actual: [50, 60], progress: 100, spend: [300000, 60] },
    { taskId: 'T-008', title: 'Doctor Scheduling Module', wbs: 'Doctor Scheduling', member: 'Bilal Ahmed', duration: 10, preds: ['T-006'], cost: 300000, actual: [64, null], progress: 70, spend: [240000, 80] },
    { taskId: 'T-009', title: 'Online Consultation Module', wbs: 'Online Consultation', member: 'Sara Malik', duration: 12, preds: ['T-004', 'T-005'], cost: 350000, actual: [50, 64], progress: 100, spend: [360000, 64] },
    { taskId: 'T-010', title: 'Billing Module', wbs: 'Billing Module', member: 'Hamza Iqbal', duration: 12, preds: ['T-006'], cost: 350000, actual: [64, null], progress: 60, spend: [230000, 80] },
    { taskId: 'T-011', title: 'System Integration', wbs: 'System Integration', member: 'Usman Tariq', duration: 14, preds: ['T-007', 'T-008', 'T-009', 'T-010'], cost: 450000 },
    { taskId: 'T-012', title: 'Testing', wbs: 'Functional Testing', member: 'Zainab Hussain', duration: 21, preds: ['T-011'], cost: 450000 },
    { taskId: 'T-013', title: 'Deployment', wbs: 'Final Deployment', member: 'Fatima Noor', duration: 8, preds: ['T-012'], cost: 250000 },
  ],

  // [title, description, linked taskId, completed?]
  milestones: [
    ['Requirements Signed Off', 'Hospital Management Board approves the requirements specification', 'T-001', true],
    ['System Design Approved', 'Architecture and design documents approved', 'T-002', true],
    ['Core Platform Ready', 'Core backend APIs available for module development', 'T-004', true],
    ['Healthcare Modules Complete', 'All five healthcare modules development finished', 'T-010', false],
    ['System Integration Complete', 'All modules integrated into one platform', 'T-011', false],
    ['Testing Complete', 'Functional testing passed with no critical defects', 'T-012', false],
    ['Go-Live (Final Deployment)', 'Software deployed to all 5 hospitals', 'T-013', false],
  ],

  changeRequest: {
    changeId: 'CR-001',
    title: 'AI Diagnosis and Mobile Application',
    description: 'Hospital management requests an AI-Based Preliminary Diagnosis Module and a Mobile Application for patients.',
    justification: 'Improves early triage for patients and gives patients mobile access to appointments, reports and consultations.',
    costImpact: 800000,
    scheduleImpactWeeks: 3,
    wbsParent: 'Healthcare Modules',
    predecessorTasks: ['T-011'],
    successorTasks: ['T-012'],
    items: [
      { reqId: 'REQ-006', title: 'AI-Based Preliminary Diagnosis Module', description: 'Suggests a preliminary diagnosis from patient-reported symptoms for doctor review.', priority: 'High', workTitle: 'AI Diagnosis Module Development', duration: 21, cost: 450000, member: 'Hamza Iqbal' },
      { reqId: 'REQ-007', title: 'Mobile Application', description: 'Patient mobile app for appointments, laboratory reports and consultations.', priority: 'High', workTitle: 'Mobile Application Development', duration: 21, cost: 350000, member: 'Usman Tariq' },
    ],
  },

  defects: [
    { defectId: 'DEF-001', title: 'Appointment Double Booking', description: 'Multiple patients can book the same doctor at the same time.', severity: 'Critical', status: 'Open', member: 'Hamza Iqbal', task: 'T-006' },
    { defectId: 'DEF-002', title: 'Patient Record Management Failure', description: 'Patient records are not consistently saved or retrieved correctly.', severity: 'Critical', status: 'Open', member: 'Fatima Noor', task: 'T-004' },
    { defectId: 'DEF-003', title: 'Laboratory report header misaligned', description: 'Hospital logo overlaps the report title on printed laboratory reports.', severity: 'Low', status: 'Resolved', member: 'Usman Tariq', task: 'T-007' },
  ],

  // [deliverable, item, result, status, remarks]
  checklists: [
    ['Appointment Module', 'Appointment creation works', 'Pass', 'Completed', 'Verified in all 5 hospital configurations'],
    ['Appointment Module', 'Doctor availability is checked', 'Pass', 'Completed', ''],
    ['Appointment Module', 'Double booking is prevented', 'Fail', 'Completed', 'DEF-001: two patients booked the same slot concurrently'],
    ['Appointment Module', 'Appointment cancellation works', 'Pass', 'Completed', ''],
    ['Appointment Module', 'Critical defects are resolved', 'Fail', 'Completed', 'DEF-001 and DEF-002 still open'],
    ['Patient Record Management', 'Patient records are saved correctly', 'Fail', 'Completed', 'DEF-002: intermittent save failures'],
    ['Patient Record Management', 'Patient records are retrieved consistently', 'Fail', 'Completed', 'DEF-002'],
    ['Laboratory Reports', 'Test results are linked to the correct patient', 'Pass', 'Completed', ''],
    ['Laboratory Reports', 'Reports can be viewed and printed', 'Pass', 'Completed', 'DEF-003 fixed and verified'],
    ['Hospital Billing', 'Invoices total consultation and test charges correctly', 'Not Inspected', 'Pending', 'Billing module still in development'],
  ],

  risks: [
    { riskId: 'RSK-001', title: 'Budget Overrun', description: 'Development costs exceed the approved budget as tasks consume more effort than estimated.', likelihood: 3, impact: 4 },
    { riskId: 'RSK-002', title: 'Schedule Delay', description: 'Module development and integration slip past the approved deadline.', likelihood: 4, impact: 4 },
    { riskId: 'RSK-003', title: 'Database Failure', description: 'Database outage or corruption causes loss of patient and project data.', likelihood: 2, impact: 5 },
    { riskId: 'RSK-004', title: 'Critical Software Defects', description: 'Critical defects in appointment scheduling and patient records reach production.', likelihood: 4, impact: 5 },
  ],

  // [riskId, problem, preventive, corrective]
  riskResponses: [
    ['RSK-001', 'Actual expenditure exceeds planned cost on development tasks', 'Weekly EVM review with automatic CPI < 1 warnings', 'Re-baseline through change control and reallocate remaining contingency'],
    ['RSK-002', 'Healthcare modules finish after their planned end dates', 'Track SPI and delayed tasks weekly; resolve blocking dependencies early', 'Fast-track parallel tasks and add resources to critical-path activities'],
    ['RSK-003', 'Database Failure', 'Regular database backups.', 'Restore the latest valid backup.'],
    ['RSK-003', 'Data corruption after a failed deployment', 'Run migrations in transactions and test on a staging copy first', 'Roll back the deployment and restore the pre-deployment snapshot'],
    ['RSK-004', 'Appointment double booking reaches production', 'Concurrency tests and slot-locking checks in the quality checklist', 'Hotfix with a unique doctor-slot constraint and notify affected patients'],
    ['RSK-004', 'Patient records lost or inconsistent', 'Transactional writes and integration tests for save/retrieve', 'Restore records from backup and run data reconciliation'],
  ],
};
