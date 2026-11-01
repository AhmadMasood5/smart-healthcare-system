const mongoose = require('mongoose');
const { RISK_PRIORITIES } = require('./constants');

const scaleField = (label) => ({
  type: Number,
  required: [true, `${label} is required`],
  min: [1, `${label} must be between 1 and 5`],
  max: [5, `${label} must be between 1 and 5`],
  validate: { validator: Number.isInteger, message: `${label} must be a whole number` },
});

// Risk Score = Likelihood x Impact. Priority bands: High >= 15, Medium 8-14, Low <= 7.
function calculateRiskScore(likelihood, impact) {
  return likelihood * impact;
}

function priorityForScore(score) {
  if (score >= 15) return 'High';
  if (score >= 8) return 'Medium';
  return 'Low';
}

const riskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    riskId: { type: String, required: true, trim: true },
    title: { type: String, required: [true, 'Risk title is required'], trim: true },
    description: { type: String, required: [true, 'Risk description is required'], trim: true },
    likelihood: scaleField('Likelihood'),
    impact: scaleField('Impact'),
    score: { type: Number },
    priority: { type: String, enum: RISK_PRIORITIES },
  },
  { timestamps: true }
);

riskSchema.pre('validate', function computeScore() {
  if (Number.isInteger(this.likelihood) && Number.isInteger(this.impact)) {
    this.score = calculateRiskScore(this.likelihood, this.impact);
    this.priority = priorityForScore(this.score);
  }
});

riskSchema.index({ project: 1, riskId: 1 }, { unique: true });
riskSchema.index({ project: 1, score: -1 });

const Risk = mongoose.model('Risk', riskSchema);
module.exports = Risk;
module.exports.calculateRiskScore = calculateRiskScore;
module.exports.priorityForScore = priorityForScore;
