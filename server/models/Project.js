const mongoose = require('mongoose');
const { PROJECT_STATUSES } = require('./constants');
const { deadlineFrom } = require('../utils/dates');

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Project name is required'], trim: true, maxlength: 200 },
    description: { type: String, required: [true, 'Description is required'], trim: true },
    objectives: {
      type: [{ type: String, trim: true }],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.filter((o) => o && o.trim()).length > 0,
        message: 'At least one objective is required',
      },
    },
    scopeBoundaries: { type: String, required: [true, 'Scope boundaries are required'], trim: true },
    approvedBudget: {
      type: Number,
      required: [true, 'Approved budget is required'],
      min: [1, 'Approved budget must be greater than zero'],
    },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    durationWeeks: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 week'],
      validate: { validator: Number.isInteger, message: 'Duration must be a whole number of weeks' },
    },
    // Derived from startDate + durationWeeks (see utils/dates.js) so it can never drift.
    deadline: { type: Date },
    projectManager: { type: String, required: [true, 'Project manager is required'], trim: true },
    status: { type: String, enum: { values: PROJECT_STATUSES, message: 'Invalid project status' }, default: 'Planned' },
  },
  { timestamps: true }
);

projectSchema.pre('validate', function setDeadline() {
  if (this.startDate && Number.isInteger(this.durationWeeks) && this.durationWeeks > 0) {
    this.deadline = deadlineFrom(this.startDate, this.durationWeeks);
  }
});

projectSchema.index({ name: 1 });

module.exports = mongoose.model('Project', projectSchema);
