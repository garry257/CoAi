const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  fileUrl: {
    type: String,
    default: '',
  },
  rawText: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['uploaded', 'parsed', 'failed'],
    default: 'uploaded',
  },
}, { timestamps: true });

module.exports = mongoose.model('Resume', resumeSchema);
