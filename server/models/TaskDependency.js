const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Finish-to-start: successor may start only after predecessor finishes.
const taskDependencySchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    predecessor: { type: ObjectId, ref: 'Task', required: [true, 'Predecessor task is required'] },
    successor: { type: ObjectId, ref: 'Task', required: [true, 'Successor task is required'] },
    type: { type: String, enum: ['FS'], default: 'FS' },
  },
  { timestamps: true }
);

taskDependencySchema.index({ predecessor: 1, successor: 1 }, { unique: true });
taskDependencySchema.index({ project: 1 });

module.exports = mongoose.model('TaskDependency', taskDependencySchema);
