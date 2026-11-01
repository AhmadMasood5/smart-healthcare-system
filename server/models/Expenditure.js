const mongoose = require('mongoose');

const expenditureSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: [true, 'Project is required'] },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: [true, 'Related task is required'] },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Expenditure amount must be greater than zero'],
    },
    date: { type: Date, required: [true, 'Expenditure date is required'] },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

expenditureSchema.index({ project: 1, date: 1 });

module.exports = mongoose.model('Expenditure', expenditureSchema);
