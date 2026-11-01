const mongoose = require('mongoose');
const { APPROVAL_STATUSES } = require('./constants');

const { ObjectId } = mongoose.Schema.Types;

// Additional work that becomes a WBS work package + scheduled task on approval.
const proposedWorkSchema = new mongoose.Schema(
  {
    requirement: { type: ObjectId, ref: 'Requirement', required: true },
    title: { type: String, required: [true, 'Work title is required'], trim: true },
    estimatedDuration: {
      type: Number,
      required: [true, 'Estimated duration is required'],
      min: [1, 'Estimated duration must be at least 1 day'],
      validate: { validator: Number.isInteger, message: 'Estimated duration must be a whole number of days' },
    },
    plannedCost: { type: Number, required: true, min: [0, 'Planned cost cannot be negative'] },
    assignedTo: { type: ObjectId, ref: 'TeamMember', default: null },
    createdTask: { type: ObjectId, ref: 'Task', default: null },
  },
  { _id: false }
);

const changeRequestSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    changeId: { type: String, required: true, trim: true },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, required: [true, 'Description is required'], trim: true },
    justification: { type: String, required: [true, 'Justification is required'], trim: true },
    proposedRequirements: [{ type: ObjectId, ref: 'Requirement' }],
    costImpact: { type: Number, required: [true, 'Cost impact is required'], min: [0, 'Cost impact cannot be negative'] },
    scheduleImpactWeeks: {
      type: Number,
      required: [true, 'Schedule impact is required'],
      min: [0, 'Schedule impact cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Schedule impact must be a whole number of weeks' },
    },
    proposedWork: { type: [proposedWorkSchema], default: [] },
    // Where the new work packages go in the WBS, and how the new tasks join the network.
    wbsParent: { type: ObjectId, ref: 'WBSItem', default: null },
    predecessorTasks: [{ type: ObjectId, ref: 'Task' }],
    successorTasks: [{ type: ObjectId, ref: 'Task' }],
    status: { type: String, enum: { values: APPROVAL_STATUSES, message: 'Invalid status' }, default: 'Pending' },
    decisionDate: { type: Date, default: null },
    decisionNotes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

changeRequestSchema.index({ project: 1, changeId: 1 }, { unique: true });
changeRequestSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
