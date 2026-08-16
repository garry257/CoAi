const mongoose = require('mongoose');

const candidateProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
  },
  skills: [String],
  languages: [String],
  frameworks: [String],
  databases: [String],
  tools: [String],
  projects: [{
    name: String,
    description: String,
    techUsed: [String],
  }],
  experience: [{
    role: String,
    company: String,
    duration: String,
    description: String,
  }],
  education: [{
    degree: String,
    institution: String,
    year: String,
  }],
  certifications: [String],
  claimedTopics: [String],
  suggestedInterviewTopics: [String],
  validatedByBackend: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('CandidateProfile', candidateProfileSchema);
