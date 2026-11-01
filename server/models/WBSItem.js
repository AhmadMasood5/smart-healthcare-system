const mongoose = require('mongoose');
const { WBS_TYPES } = require('./constants');

const wbsItemSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    title: { type: String, required: [true, 'WBS title is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    type: { type: String, required: true, enum: { values: WBS_TYPES, message: 'Invalid WBS item type' } },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'WBSItem', default: null },
    // Only approved requirements may be linked (enforced in services/wbsService.js).
    requirement: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

wbsItemSchema.index({ project: 1, parent: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('WBSItem', wbsItemSchema);
