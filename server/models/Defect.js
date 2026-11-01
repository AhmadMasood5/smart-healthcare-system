const mongoose = require('mongoose');
const { DEFECT_SEVERITIES, DEFECT_STATUSES } = require('./constants');

const { ObjectId } = mongoose.Schema.Types;

const defectSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    defectId: { type: String, required: true, trim: true },
    title: { type: String, required: [true, 'Defect title is required'], trim: true },
    description: { type: String, required: [true, 'Defect description is required'], trim: true },
    severity: { type: String, required: [true, 'Severity is required'], enum: { values: DEFECT_SEVERITIES, message: 'Invalid severity' } },
    status: { type: String, enum: { values: DEFECT_STATUSES, message: 'Invalid resolution status' }, default: 'Open' },
    assignedTo: { type: ObjectId, ref: 'TeamMember', default: null },
    relatedTask: { type: ObjectId, ref: 'Task', default: null },
    relatedDeliverable: { type: ObjectId, ref: 'WBSItem', default: null },
  },
  { timestamps: true }
);

defectSchema.pre('validate', function requireRelation() {
  if (!this.relatedTask && !this.relatedDeliverable) {
    this.invalidate('relatedTask', 'A related task or deliverable is required');
  }
});

defectSchema.index({ project: 1, defectId: 1 }, { unique: true });
defectSchema.index({ project: 1, severity: 1, status: 1 });

module.exports = mongoose.model('Defect', defectSchema);
