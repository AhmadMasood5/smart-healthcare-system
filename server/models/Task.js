const mongoose = require('mongoose');
const { TASK_STATUSES } = require('./constants');

const { ObjectId } = mongoose.Schema.Types;

const taskSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    taskId: { type: String, required: true, trim: true },
    title: { type: String, required: [true, 'Task title is required'], trim: true },
    description: { type: String, trim: true, default: '' },
    assignedTo: { type: ObjectId, ref: 'TeamMember', default: null },
    wbsItem: { type: ObjectId, ref: 'WBSItem', default: null },
    estimatedDuration: {
      type: Number,
      required: [true, 'Estimated duration is required'],
      min: [1, 'Estimated duration must be at least 1 day'],
      validate: { validator: Number.isInteger, message: 'Estimated duration must be a whole number of days' },
    },
    // Computed by the scheduling engine (services/scheduleService.js).
    plannedStartDate: { type: Date, default: null },
    plannedEndDate: { type: Date, default: null },
    actualStartDate: { type: Date, default: null },
    actualEndDate: { type: Date, default: null },
    progress: {
      type: Number,
      default: 0,
      min: [0, 'Progress must be between 0 and 100'],
      max: [100, 'Progress must be between 0 and 100'],
    },
    status: { type: String, enum: { values: TASK_STATUSES, message: 'Invalid task status' }, default: 'Not Started' },
    changeRequest: { type: ObjectId, ref: 'ChangeRequest', default: null },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, taskId: 1 }, { unique: true });

module.exports = mongoose.model('Task', taskSchema);
