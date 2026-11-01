const mongoose = require('mongoose');
const { MILESTONE_STATUSES } = require('./constants');

const milestoneSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    title: { type: String, required: [true, 'Milestone title is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    plannedDate: { type: Date, required: [true, 'Planned date is required'] },
    actualCompletionDate: { type: Date, default: null },
    completionStatus: {
      type: String,
      enum: { values: MILESTONE_STATUSES, message: 'Invalid milestone status' },
      default: 'Pending',
    },
    // Optional: when linked, the planned date follows the task's scheduled finish.
    linkedTask: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  },
  { timestamps: true }
);

milestoneSchema.pre('validate', function checkCompletion() {
  if (this.completionStatus === 'Completed' && !this.actualCompletionDate) {
    this.invalidate('actualCompletionDate', 'Actual completion date is required for a completed milestone');
  }
  if (this.completionStatus === 'Pending' && this.actualCompletionDate) {
    this.invalidate('completionStatus', 'Set status to Completed when an actual completion date is recorded');
  }
});

milestoneSchema.index({ project: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('Milestone', milestoneSchema);
