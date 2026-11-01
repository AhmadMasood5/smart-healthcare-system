const mongoose = require('mongoose');
const { INFLUENCE_LEVELS } = require('./constants');

const stakeholderSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    name: { type: String, required: [true, 'Stakeholder name is required'], trim: true },
    role: { type: String, required: [true, 'Stakeholder role is required'], trim: true },
    interest: { type: String, trim: true, default: '' },
    influence: { type: String, enum: { values: INFLUENCE_LEVELS, message: 'Invalid influence level' }, default: 'Medium' },
  },
  { timestamps: true }
);

stakeholderSchema.index({ project: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Stakeholder', stakeholderSchema);
