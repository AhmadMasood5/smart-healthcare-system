const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    changeRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ChangeRequest' },
  },
  { _id: false }
);

const projectPlanSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    scopePlan: { type: String, required: [true, 'Scope plan is required'], trim: true },
    schedulePlan: { type: String, required: [true, 'Schedule plan is required'], trim: true },
    costPlan: { type: String, required: [true, 'Cost plan is required'], trim: true },
    qualityPlan: { type: String, required: [true, 'Quality plan is required'], trim: true },
    version: { type: Number, default: 1 },
    // Baseline snapshot this version of the plan is built on.
    baselineBudget: { type: Number, min: 0 },
    baselineDurationWeeks: { type: Number, min: 0 },
    baselineDeadline: { type: Date },
    revisions: { type: [revisionSchema], default: [] },
  },
  { timestamps: true }
);

projectPlanSchema.index({ project: 1 }, { unique: true });

module.exports = mongoose.model('ProjectPlan', projectPlanSchema);
