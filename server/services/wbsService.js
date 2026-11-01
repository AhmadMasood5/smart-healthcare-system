const { WBSItem, Requirement } = require('../models');
const AppError = require('../utils/AppError');
const { pick } = require('../utils/http');
const { requireProject, assertSameProject, findOr404 } = require('./referenceService');

const EDITABLE = ['title', 'description', 'type', 'parent', 'requirement', 'order'];

async function validateRelations(item, session = null) {
  if (item.parent) {
    if (String(item.parent) === String(item._id)) throw new AppError(400, 'A WBS item cannot be its own parent');
    const parent = await assertSameProject(WBSItem, item.parent, item.project, 'Parent WBS item', session);
    if (parent.type === 'Work Package') {
      throw new AppError(400, 'A work package is the lowest WBS level and cannot have child items');
    }
    // Walk up from the new parent; reaching this item means the move would create a cycle.
    let cursor = parent;
    const seen = new Set();
    while (cursor && cursor.parent) {
      const pid = String(cursor.parent);
      if (pid === String(item._id)) throw new AppError(400, 'Circular WBS hierarchy: an item cannot be moved under its own descendant');
      if (seen.has(pid)) break;
      seen.add(pid);
      cursor = await WBSItem.findById(pid).session(session);
    }
  }
  if (item.requirement) {
    const req = await assertSameProject(Requirement, item.requirement, item.project, 'Requirement', session);
    if (req.approvalStatus !== 'Approved') {
      throw new AppError(400, `Only approved requirements can be linked to the WBS (${req.reqId} is ${req.approvalStatus})`);
    }
  }
  if (item.type === 'Work Package' && !item.isNew) {
    const children = await WBSItem.countDocuments({ parent: item._id }).session(session);
    if (children > 0) throw new AppError(400, 'An item with child items cannot be changed into a work package');
  }
}

async function listWbs(projectId) {
  await requireProject(projectId);
  return WBSItem.find({ project: projectId }).populate('requirement', 'reqId title approvalStatus').sort({ order: 1, createdAt: 1 });
}

// Nested tree with outline codes (1, 1.1, 1.1.1 ...) derived from sibling order.
async function getWbsTree(projectId) {
  const items = (await listWbs(projectId)).map((i) => i.toObject());
  const byParent = new Map();
  for (const i of items) {
    const key = i.parent ? String(i.parent) : 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(i);
  }
  const build = (key, prefix) =>
    (byParent.get(key) || []).map((node, idx) => {
      const code = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
      return { ...node, code, children: build(String(node._id), code) };
    });
  return build('root', '');
}

async function createWbsItem(body, session = null) {
  const project = await requireProject(body.project, session);
  const data = pick(body, EDITABLE);
  if (data.parent === '') data.parent = null;
  if (data.requirement === '') data.requirement = null;
  const item = new WBSItem({ ...data, project: project._id });
  if (data.order === undefined) {
    item.order = await WBSItem.countDocuments({ project: project._id, parent: item.parent || null }).session(session);
  }
  await validateRelations(item, session);
  await item.save({ session });
  return item;
}

async function updateWbsItem(id, body) {
  const item = await findOr404(WBSItem, id, 'WBS item');
  const data = pick(body, EDITABLE);
  if (data.parent === '') data.parent = null;
  if (data.requirement === '') data.requirement = null;
  item.set(data);
  await validateRelations(item);
  await item.save();
  return item;
}

module.exports = { listWbs, getWbsTree, createWbsItem, updateWbsItem };
