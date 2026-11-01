const mongoose = require('mongoose');
const { CLOSURE_STATUSES } = require('./constants');

const projectClosureSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    closureDate: { type: Date, required: [true, 'Closure date is required'] },
    closureStatus: { type: String, enum: { values: CLOSURE_STATUSES, message: 'Invalid closure status' }, default: 'Draft' },
    closureNotes: { type: String, required: [true, 'Closure notes are required'], trim: true },
    finalSummary: { type: String, required: [true, 'Final project summary is required'], trim: true },
  },
  { timestamps: true }
);

projectClosureSchema.index({ project: 1 }, { unique: true });

module.exports = mongoose.model('ProjectClosure', projectClosureSchema);
