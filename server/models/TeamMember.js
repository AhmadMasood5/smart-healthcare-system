const mongoose = require('mongoose');
const { TEAM_ROLES } = require('./constants');

const teamMemberSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    name: { type: String, required: [true, 'Member name is required'], trim: true },
    role: { type: String, required: [true, 'Role is required'], enum: { values: TEAM_ROLES, message: 'Invalid role' } },
    responsibilities: { type: String, required: [true, 'Responsibilities are required'], trim: true },
  },
  { timestamps: true }
);

teamMemberSchema.index({ project: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
