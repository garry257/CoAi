const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  candidateText: {
    type: String,
    default: '',
  },
  submittedAt: Date,
  duration_seconds: Number, // How long the candidate spent on this answer
});

const questionSchema = new mongoose.Schema({
  interviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview',
    required: true,
    index: true,
  },
  topic: {
    type: String,
    required: true,
  },
  subtopic: {
    type: String,
    default: '',
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  question: {
    type: String,
    required: true,
  },
  expectedConcepts: [String], // List of key concepts that should be covered
  estimatedAnswerSeconds: {
    type: Number,
    default: 120, // Default 2 minutes
  },
  followUpQuestions: [
    {
      condition: String, // When to ask this follow-up (e.g., "if answer mentions X")
      followUpQuestion: String,
    }
  ],
  questionNumber: {
    type: Number, // Sequential order in interview (1, 2, 3, ...)
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'answered', 'skipped'],
    default: 'pending',
  },
  answer: answerSchema,
  feedback: {
    type: String,
    default: '',
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
