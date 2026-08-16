const Interview = require('../models/Interview');
const Question = require('../models/Question');
const CandidateProfile = require('../models/CandidateProfile');
const Resume = require('../models/Resume');
const { generateInterviewQuestions } = require('../services/interview/questionGenerator');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Create a new interview with configuration
 * POST /api/interviews
 */
exports.createInterview = asyncHandler(async (req, res) => {
  const { role, interviewType, difficulty, durationMinutes, company, candidateProfileId } = req.body;

  // Validate required fields
  if (!role || !interviewType || !durationMinutes) {
    return res.status(400).json({
      success: false,
      message: 'role, interviewType, and durationMinutes are required'
    });
  }

  if (!['technical', 'hr', 'fullstack', 'ai_genai', 'resume_based', 'company_specific'].includes(interviewType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid interviewType'
    });
  }

  if (![10, 20, 30, 45, 60].includes(durationMinutes)) {
    return res.status(400).json({
      success: false,
      message: 'durationMinutes must be one of: 10, 20, 30, 45, 60'
    });
  }

  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return res.status(400).json({
      success: false,
      message: 'difficulty must be one of: easy, medium, hard'
    });
  }

  try {
    // Get or use provided candidate profile
    let candidateProfile = null;
    if (candidateProfileId) {
      candidateProfile = await CandidateProfile.findById(candidateProfileId);
      if (!candidateProfile) {
        return res.status(404).json({
          success: false,
          message: 'Candidate profile not found'
        });
      }
    } else {
      // Try to fetch latest candidate profile for this user
      candidateProfile = await CandidateProfile.findOne({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(1);
    }

    if (!candidateProfile) {
      return res.status(400).json({
        success: false,
        message: 'No candidate profile found. Please upload and analyze a resume first.'
      });
    }

    // Create interview document
    const interview = new Interview({
      userId: req.user.id,
      candidateProfileId: candidateProfile._id,
      role,
      interviewType,
      company: company || '',
      difficulty,
      durationMinutes,
      status: 'planned',
    });

    await interview.save();

    logger.info('[InterviewController] Interview created', {
      interviewId: interview._id,
      userId: req.user.id,
      role,
      interviewType,
    });

    res.status(201).json({
      success: true,
      data: interview,
      message: 'Interview created successfully'
    });
  } catch (error) {
    logger.error('[InterviewController] createInterview error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating interview'
    });
  }
});

/**
 * Start interview and generate questions
 * POST /api/interviews/:id/start
 */
exports.startInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await Interview.findById(id).populate('candidateProfileId');

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // Verify ownership
    if (interview.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to start this interview'
      });
    }

    if (interview.status !== 'planned') {
      return res.status(400).json({
        success: false,
        message: `Interview cannot be started from status: ${interview.status}`
      });
    }

    // Generate questions using Gemini
    logger.info('[InterviewController] Generating questions for interview', { interviewId: id });

    const questions = await generateInterviewQuestions({
      role: interview.role,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      durationMinutes: interview.durationMinutes,
      candidateProfile: interview.candidateProfileId,
      company: interview.company || undefined,
    });

    // Save questions to database
    const savedQuestions = [];
    for (const q of questions) {
      const question = new Question({
        interviewId: interview._id,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        question: q.question,
        expectedConcepts: q.expectedConcepts,
        estimatedAnswerSeconds: q.estimatedAnswerSeconds,
        followUpQuestions: q.followUpQuestions,
        questionNumber: q.questionNumber,
        status: 'pending',
      });
      await question.save();
      savedQuestions.push(question);
    }

    // Update interview
    interview.status = 'in_progress';
    interview.startedAt = new Date();
    interview.totalQuestionsPlanned = savedQuestions.length;
    interview.currentQuestionIndex = 0;
    await interview.save();

    logger.info('[InterviewController] Interview started', {
      interviewId: id,
      questionsGenerated: savedQuestions.length,
    });

    res.json({
      success: true,
      data: {
        interview,
        questions: savedQuestions.slice(0, 1), // Return first question to start
        totalQuestions: savedQuestions.length,
      },
      message: 'Interview started successfully'
    });
  } catch (error) {
    logger.error('[InterviewController] startInterview error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error starting interview'
    });
  }
});

/**
 * Get current question for interview
 * GET /api/interviews/:id/current-question
 */
exports.getCurrentQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this interview'
      });
    }

    const question = await Question.findOne({
      interviewId: id,
      questionNumber: interview.currentQuestionIndex + 1,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Current question not found'
      });
    }

    // Calculate elapsed time for timer
    const startedAt = interview.startedAt ? new Date(interview.startedAt) : new Date();
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const totalSeconds = interview.durationMinutes * 60;
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

    res.json({
      success: true,
      data: {
        question,
        currentQuestionNumber: interview.currentQuestionIndex + 1,
        totalQuestions: interview.totalQuestionsPlanned,
        elapsedSeconds,
        remainingSeconds,
        interviewStatus: interview.status,
      }
    });
  } catch (error) {
    logger.error('[InterviewController] getCurrentQuestion error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching current question'
    });
  }
});

/**
 * Submit answer to a question
 * POST /api/interviews/:id/answer
 */
exports.submitAnswer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { questionNumber, answerText, durationSeconds } = req.body;

  if (!questionNumber || !answerText) {
    return res.status(400).json({
      success: false,
      message: 'questionNumber and answerText are required'
    });
  }

  try {
    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to answer questions in this interview'
      });
    }

    const question = await Question.findOne({
      interviewId: id,
      questionNumber,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Save answer
    question.answer = {
      candidateText: answerText,
      submittedAt: new Date(),
      duration_seconds: durationSeconds || interview.durationMinutes * 60 / interview.totalQuestionsPlanned,
    };
    question.status = 'answered';

    await question.save();

    // Update interview progress
    interview.currentQuestionIndex += 1;
    interview.questionsAnswered += 1;
    await interview.save();

    logger.info('[InterviewController] Answer submitted', {
      interviewId: id,
      questionNumber,
      questionsAnswered: interview.questionsAnswered,
    });

    // Check if interview is complete
    const isComplete = interview.questionsAnswered >= interview.totalQuestionsPlanned;

    let nextQuestion = null;
    if (!isComplete) {
      nextQuestion = await Question.findOne({
        interviewId: id,
        questionNumber: interview.currentQuestionIndex + 1,
      });
    }

    res.json({
      success: true,
      data: {
        questionAnswered: questionNumber,
        nextQuestionNumber: nextQuestion ? nextQuestion.questionNumber : null,
        totalAnswered: interview.questionsAnswered,
        isInterviewComplete: isComplete,
      },
      message: isComplete ? 'Interview completed!' : 'Answer recorded successfully'
    });
  } catch (error) {
    logger.error('[InterviewController] submitAnswer error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error submitting answer'
    });
  }
});

/**
 * Get interview details with all questions and answers
 * GET /api/interviews/:id
 */
exports.getInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await Interview.findById(id)
      .populate('candidateProfileId')
      .populate('userId', 'username email');

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this interview'
      });
    }

    const questions = await Question.find({ interviewId: id }).sort({ questionNumber: 1 });

    res.json({
      success: true,
      data: {
        interview,
        questions,
      }
    });
  } catch (error) {
    logger.error('[InterviewController] getInterview error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching interview'
    });
  }
});

/**
 * List all interviews for the user
 * GET /api/interviews
 */
exports.listInterviews = asyncHandler(async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('role interviewType company durationMinutes status startedAt endedAt overallScore totalQuestionsPlanned questionsAnswered');

    res.json({
      success: true,
      data: interviews,
    });
  } catch (error) {
    logger.error('[InterviewController] listInterviews error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching interviews'
    });
  }
});

/**
 * Complete interview (end prematurely or on time)
 * POST /api/interviews/:id/complete
 */
exports.completeInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this interview'
      });
    }

    if (interview.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Interview is already completed'
      });
    }

    // Calculate actual duration
    const startedAt = interview.startedAt || new Date();
    const actualDurationSeconds = Math.floor((Date.now() - new Date(startedAt)) / 1000);

    interview.status = 'completed';
    interview.endedAt = new Date();
    interview.actualDurationSeconds = actualDurationSeconds;

    await interview.save();

    // Get all answered questions for summary
    const answeredQuestions = await Question.find({
      interviewId: id,
      status: 'answered',
    });

    logger.info('[InterviewController] Interview completed', {
      interviewId: id,
      actualDurationSeconds,
      questionsAnswered: answeredQuestions.length,
    });

    res.json({
      success: true,
      data: {
        interview,
        questionsAnswered: answeredQuestions.length,
        totalQuestions: interview.totalQuestionsPlanned,
      },
      message: 'Interview completed successfully'
    });
  } catch (error) {
    logger.error('[InterviewController] completeInterview error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing interview'
    });
  }
});

/**
 * Skip current question
 * POST /api/interviews/:id/skip-question
 */
exports.skipQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    if (interview.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to skip questions in this interview'
      });
    }

    const question = await Question.findOne({
      interviewId: id,
      questionNumber: interview.currentQuestionIndex + 1,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Current question not found'
      });
    }

    // Mark as skipped
    question.status = 'skipped';
    await question.save();

    // Move to next question
    interview.currentQuestionIndex += 1;
    await interview.save();

    const nextQuestion = await Question.findOne({
      interviewId: id,
      questionNumber: interview.currentQuestionIndex + 1,
    });

    res.json({
      success: true,
      data: {
        skippedQuestion: question.questionNumber,
        nextQuestion: nextQuestion || null,
      },
      message: 'Question skipped'
    });
  } catch (error) {
    logger.error('[InterviewController] skipQuestion error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error skipping question'
    });
  }
});

module.exports = exports;
