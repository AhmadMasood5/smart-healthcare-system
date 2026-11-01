const mongoose = require('mongoose');
const { INSPECTION_RESULTS, CHECKLIST_STATUSES } = require('./constants');

const qualityChecklistSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    deliverable: { type: String, required: [true, 'Deliverable is required'], trim: true },
    item: { type: String, required: [true, 'Checklist item is required'], trim: true },
    inspectionResult: {
      type: String,
      enum: { values: INSPECTION_RESULTS, message: 'Invalid inspection result' },
      default: 'Not Inspected',
    },
    status: { type: String, enum: { values: CHECKLIST_STATUSES, message: 'Invalid checklist status' }, default: 'Pending' },
    remarks: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

qualityChecklistSchema.pre('validate', function checkResult() {
  if (this.status === 'Completed' && this.inspectionResult === 'Not Inspected') {
    this.invalidate('inspectionResult', 'Record a Pass or Fail result before completing the inspection');
  }
});

qualityChecklistSchema.index({ project: 1, deliverable: 1, item: 1 }, { unique: true });

module.exports = mongoose.model('QualityChecklist', qualityChecklistSchema);
