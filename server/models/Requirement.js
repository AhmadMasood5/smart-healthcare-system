const mongoose = require('mongoose');
const { REQUIREMENT_PRIORITIES, APPROVAL_STATUSES, REQUIREMENT_SOURCES } = require('./constants');

const requirementSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    reqId: { type: String, required: true, trim: true },
    title: { type: String, required: [true, 'Requirement title is required'], trim: true },
    description: { type: String, required: [true, 'Requirement description is required'], trim: true },
    priority: {
      type: String,
      enum: { values: REQUIREMENT_PRIORITIES, message: 'Invalid priority' },
      default: 'Medium',
    },
    approvalStatus: {
      type: String,
      enum: { values: APPROVAL_STATUSES, message: 'Invalid approval status' },
      default: 'Pending',
    },
    source: { type: String, enum: REQUIREMENT_SOURCES, default: 'Original' },
    changeRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ChangeRequest', default: null },
  },
  { timestamps: true }
);

requirementSchema.index({ project: 1, reqId: 1 }, { unique: true });
requirementSchema.index({ project: 1, approvalStatus: 1 });

module.exports = mongoose.model('Requirement', requirementSchema);
