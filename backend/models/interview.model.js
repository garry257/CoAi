const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  candidateProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CandidateProfile',
  },
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
  },
  role: {
    type: String,
    default: '',
    required: true,
  },
  interviewType: {
    type: String,
    enum: ['technical', 'hr', 'fullstack', 'ai_genai', 'resume_based', 'company_specific'],
    default: 'technical',
  },
  company: {
    type: String,
    default: '',
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  durationMinutes: {
    type: Number,
    enum: [10, 20, 30, 45, 60],
    default: 30,
  },
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'completed', 'terminated'],
    default: 'planned',
  },
  startedAt: Date,
  endedAt: Date,
  actualDurationSeconds: Number,
  topicsPlanned: [{
    topic: String,
    allocatedMinutes: Number,
  }],
  currentQuestionIndex: {
    type: Number,
    default: 0, // Index of the current question being answered
  },
  totalQuestionsPlanned: {
    type: Number,
    default: 0,
  },
  overallScore: {
    type: Number,
    default: 0,
  },
  questionsAnswered: {
    type: Number,
    default: 0,
  },
  weakTopics: [{
    topic: String,
    count: Number,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);
