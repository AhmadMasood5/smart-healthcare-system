const mongoose = require('mongoose');

// One PDPC branch: a potential problem under a risk, with its countermeasures.
const riskResponseSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    risk: { type: mongoose.Schema.Types.ObjectId, ref: 'Risk', required: [true, 'Related risk is required'] },
    potentialProblem: { type: String, required: [true, 'Potential problem is required'], trim: true },
    preventiveAction: { type: String, required: [true, 'Preventive action is required'], trim: true },
    correctiveAction: { type: String, required: [true, 'Corrective action is required'], trim: true },
  },
  { timestamps: true }
);

riskResponseSchema.index({ risk: 1, potentialProblem: 1 }, { unique: true });
riskResponseSchema.index({ project: 1 });

module.exports = mongoose.model('RiskResponse', riskResponseSchema);
