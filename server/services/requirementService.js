const { Requirement, ChangeRequest, WBSItem } = require('../models');
const AppError = require('../utils/AppError');
const { pick } = require('../utils/http');
const { REQUIREMENT_PRIORITIES } = require('../models/constants');
const { requireProject, findOr404, nextCode } = require('./referenceService');

const EDITABLE = ['title', 'description', 'priority'];
const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function sortByPriority(reqs) {
  return [...reqs].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.reqId.localeCompare(b.reqId));
}

async function listRequirements(projectId, status) {
  await requireProject(projectId);
  const filter = { project: projectId };
  if (status) filter.approvalStatus = status;
  const reqs = await Requirement.find(filter).populate('changeRequest', 'changeId title status').lean();
  return sortByPriority(reqs);
}

async function createRequirement(body, session = null, extra = {}) {
  const project = await requireProject(body.project, session);
  const req = new Requirement({
    ...pick(body, EDITABLE),
    ...extra,
    project: project._id,
    reqId: await nextCode(Requirement, 'reqId', 'REQ', project._id, session),
  });
  await req.save({ session });
  return req;
}

async function updateRequirement(id, body) {
  const req = await findOr404(Requirement, id, 'Requirement');
  req.set(pick(body, EDITABLE));
  await req.save();
  return req;
}

async function setPriority(id, priority) {
  if (!REQUIREMENT_PRIORITIES.includes(priority)) {
    throw new AppError(400, `Priority must be one of: ${REQUIREMENT_PRIORITIES.join(', ')}`);
  }
  return updateRequirement(id, { priority });
}

// Requirements raised by a change request follow the change request's decision.
async function assertDirectDecisionAllowed(req) {
  if (req.source === 'Change Request' && req.changeRequest) {
    const cr = await ChangeRequest.findById(req.changeRequest).lean();
    throw new AppError(
      409,
      `Requirement ${req.reqId} belongs to change request ${cr ? cr.changeId : ''} and can only be approved or rejected through it`
    );
  }
}

async function approveRequirement(id) {
  const req = await findOr404(Requirement, id, 'Requirement');
  await assertDirectDecisionAllowed(req);
  if (req.approvalStatus === 'Approved') throw new AppError(409, `Requirement ${req.reqId} is already approved`);
  req.approvalStatus = 'Approved';
  await req.save();
  return req;
}

async function rejectRequirement(id) {
  const req = await findOr404(Requirement, id, 'Requirement');
  await assertDirectDecisionAllowed(req);
  if (req.approvalStatus === 'Rejected') throw new AppError(409, `Requirement ${req.reqId} is already rejected`);
  const linked = await WBSItem.countDocuments({ requirement: req._id });
  if (linked > 0) {
    throw new AppError(409, `Requirement ${req.reqId} is linked to ${linked} WBS item(s); unlink them before rejecting it`);
  }
  req.approvalStatus = 'Rejected';
  await req.save();
  return req;
}

// Approved scope = approved requirements only. Pending and rejected requirements are reported as excluded.
async function getApprovedScope(projectId) {
  await requireProject(projectId);
  const [reqs, wbsLinks] = await Promise.all([
    Requirement.find({ project: projectId }).lean(),
    WBSItem.find({ project: projectId, requirement: { $ne: null } }).select('title requirement').lean(),
  ]);
  const approved = sortByPriority(reqs.filter((r) => r.approvalStatus === 'Approved')).map((r) => ({
    ...r,
    wbsItems: wbsLinks.filter((w) => String(w.requirement) === String(r._id)).map((w) => w.title),
  }));
  return {
    approved,
    excluded: {
      pending: sortByPriority(reqs.filter((r) => r.approvalStatus === 'Pending')),
      rejected: sortByPriority(reqs.filter((r) => r.approvalStatus === 'Rejected')),
    },
    counts: {
      approved: approved.length,
      pending: reqs.filter((r) => r.approvalStatus === 'Pending').length,
      rejected: reqs.filter((r) => r.approvalStatus === 'Rejected').length,
    },
  };
}

module.exports = {
  listRequirements,
  createRequirement,
  updateRequirement,
  setPriority,
  approveRequirement,
  rejectRequirement,
  getApprovedScope,
};
