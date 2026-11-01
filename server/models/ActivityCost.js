const mongoose = require('mongoose');

const activityCostSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: [true, 'Task is required'] },
    plannedCost: {
      type: Number,
      required: [true, 'Planned cost is required'],
      min: [0, 'Planned cost cannot be negative'],
    },
  },
  { timestamps: true }
);

// One cost estimate per task, so planned cost can never be double counted.
activityCostSchema.index({ task: 1 }, { unique: true });
activityCostSchema.index({ project: 1 });

module.exports = mongoose.model('ActivityCost', activityCostSchema);
