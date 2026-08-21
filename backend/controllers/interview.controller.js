const Interview = require('../models/interview.model');
const Question = require('../models/question.model');
const CandidateProfile = require('../models/candidate-profile.model');
const Resume = require('../models/resume.model');
const { generateInterviewQuestions, generateSingleQuestion } = require('../services/interview/questionGenerator');
const { evaluateAnswer } = require('../services/ai/evaluator');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

function calculateRemainingSeconds(startedAt, durationMinutes) {
  const started = startedAt ? new Date(startedAt) : new Date();
  const totalSeconds = Number(durationMinutes) * 60;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000));
  return Math.max(0, totalSeconds - elapsedSeconds);
}

function normalizeQuestionPayload(question) {
  const base = question || {};
  return {
    topic: String(base.topic || 'General'),
    subtopic: String(base.subtopic || 'General'),
    difficulty: ['easy', 'medium', 'hard'].includes(base.difficulty) ? base.difficulty : 'medium',
    question: String(base.question || '').trim(),
    expectedConcepts: Array.isArray(base.expectedConcepts) ? base.expectedConcepts.map((concept) => String(concept)) : [],
    estimatedAnswerSeconds: Number(base.estimatedAnswerSeconds) || 120,
    followUpQuestions: Array.isArray(base.followUpQuestions)
      ? base.followUpQuestions.map((item) => ({
          condition: String(item?.condition || 'Always'),
          followUpQuestion: String(item?.followUpQuestion || item?.followUpQuestion || ''),
        }))
      : [],
  };
}

function summarizeInterviewProgress(questions) {
  const answered = Array.isArray(questions) ? questions.filter((question) => question?.status === 'answered').length : 0;
  const skipped = Array.isArray(questions) ? questions.filter((question) => question?.status === 'skipped').length : 0;
  const pending = Array.isArray(questions) ? questions.filter((question) => question?.status === 'pending').length : 0;
  const total = Math.max(1, answered + skipped + pending);
  return {
    answered,
    skipped,
    pending,
    completionRate: Math.round((answered / total) * 100),
  };
}

/**
 * Create a new interview with configuration
 * POST /api/interviews
 */
exports.createInterview = asyncHandler(async (req, res) => {
  const { role, interviewType, company, candidateProfileId } = req.body;

  // Coerce types — form selects sometimes send strings
  const durationMinutes = parseInt(req.body.durationMinutes, 10);
  const difficulty = req.body.difficulty || 'medium';

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

  if (isNaN(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
    return res.status(400).json({
      success: false,
      message: 'durationMinutes must be a number between 1 and 180'
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

    // If no profile exists, create a default one for testing
    if (!candidateProfile) {
      logger.info('[InterviewController] Creating default candidate profile for user:', req.user.id);
      candidateProfile = new CandidateProfile({
        userId: req.user.id,
        skills: [],
        languages: [],
        frameworks: [],
        databases: [],
        tools: [],
        experience: [],
        resumeText: '',
      });
      await candidateProfile.save();
      logger.info('[InterviewController] Default candidate profile created:', candidateProfile._id);
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

    // Fast Instant Start: Generate Question #1 immediately
    logger.info('[InterviewController] Fast generating Question #1 for interview', { interviewId: id });

    const firstQData = await generateSingleQuestion({
      role: interview.role,
      interviewType: interview.interviewType,
      difficulty: interview.difficulty,
      durationMinutes: interview.durationMinutes,
      candidateProfile: interview.candidateProfileId,
      company: interview.company || undefined,
      questionNumber: 1,
      previousQuestions: []
    });

    const normalizedQuestion = normalizeQuestionPayload(firstQData);
    const firstQuestion = new Question({
      interviewId: interview._id,
      topic: normalizedQuestion.topic,
      subtopic: normalizedQuestion.subtopic,
      difficulty: normalizedQuestion.difficulty,
      question: normalizedQuestion.question,
      expectedConcepts: normalizedQuestion.expectedConcepts,
      estimatedAnswerSeconds: normalizedQuestion.estimatedAnswerSeconds,
      followUpQuestions: normalizedQuestion.followUpQuestions,
      questionNumber: 1,
      status: 'pending',
    });
    await firstQuestion.save();

    // Set total questions = duration in minutes (10 min → 10 questions)
    const totalPlanned = interview.durationMinutes;
    interview.status = 'in_progress';
    interview.startedAt = new Date();
    interview.totalQuestionsPlanned = totalPlanned;
    interview.currentQuestionIndex = 0;
    await interview.save();

    logger.info('[InterviewController] Fast interview started', { interviewId: id, totalQuestions: totalPlanned });

    res.json({
      success: true,
      data: {
        interview,
        questions: [firstQuestion],
        totalQuestions: totalPlanned,
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

    const remainingSeconds = calculateRemainingSeconds(interview.startedAt, interview.durationMinutes);

    if (remainingSeconds <= 0 && interview.status === 'in_progress') {
      interview.status = 'completed';
      interview.endedAt = new Date();
      interview.actualDurationSeconds = interview.durationMinutes * 60;
      await interview.save();
    }

    let question = await Question.findOne({
      interviewId: id,
      questionNumber: interview.currentQuestionIndex + 1,
    });

    if (!question && remainingSeconds > 0 && interview.status === 'in_progress') {
      // Dynamically generate next question if not found yet
      const prevQuestions = await Question.find({ interviewId: id });
      const nextQData = await generateSingleQuestion({
        role: interview.role,
        interviewType: interview.interviewType,
        difficulty: interview.difficulty,
        durationMinutes: interview.durationMinutes,
        candidateProfile: interview.candidateProfileId,
        company: interview.company,
        questionNumber: interview.currentQuestionIndex + 1,
        previousQuestions: prevQuestions,
      });

      const normalizedQ = normalizeQuestionPayload(nextQData);
      question = new Question({
        interviewId: interview._id,
        topic: normalizedQ.topic,
        subtopic: normalizedQ.subtopic,
        difficulty: normalizedQ.difficulty,
        question: normalizedQ.question,
        expectedConcepts: normalizedQ.expectedConcepts,
        estimatedAnswerSeconds: normalizedQ.estimatedAnswerSeconds,
        followUpQuestions: normalizedQ.followUpQuestions,
        questionNumber: interview.currentQuestionIndex + 1,
        status: 'pending',
      });
      await question.save();
    }

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Current question not found'
      });
    }

    const startedAt = interview.startedAt ? new Date(interview.startedAt) : new Date();
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);

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
/**
 * Submit answer to a question (Sub-100ms Ultra-Fast Version)
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

    const remainingSeconds = calculateRemainingSeconds(interview.startedAt, interview.durationMinutes);
    if (remainingSeconds <= 0 && interview.status === 'in_progress') {
      interview.status = 'completed';
      interview.endedAt = new Date();
      interview.actualDurationSeconds = interview.durationMinutes * 60;
      await interview.save();
      return res.json({
        success: true,
        data: {
          questionAnswered: questionNumber,
          isInterviewComplete: true,
          totalAnswered: interview.questionsAnswered,
        },
        message: 'Interview duration has expired.'
      });
    }

    // 1. Instant Save Candidate Answer
    question.answer = {
      candidateText: answerText,
      submittedAt: new Date(),
      duration_seconds: Number(durationSeconds) || 60,
    };
    question.status = 'answered';
    await question.save();

    // 2. Async Background AI Evaluation (Non-blocking for instant speed!)
    evaluateAnswer(
      question.question,
      answerText,
      question.expectedConcepts || [],
      question.topic || ''
    ).then(async (evaluation) => {
      try {
        const qToUpdate = await Question.findById(question._id);
        if (qToUpdate) {
          qToUpdate.score = evaluation.score;
          qToUpdate.feedback = evaluation.feedback;
          await qToUpdate.save();
          logger.info('[InterviewController] Async evaluation saved for question:', question._id);
        }
      } catch (err) {
        logger.warn('[InterviewController] Async evaluation update failed:', err.message);
      }
    }).catch(err => {
      logger.warn('[InterviewController] Async evaluation error:', err.message);
    });

    // 3. Update Progress Counters
    interview.currentQuestionIndex += 1;
    interview.questionsAnswered += 1;
    await interview.save();

    const isTimerExpired = remainingSeconds <= 0;
    const allQuestionsAnswered = interview.currentQuestionIndex >= interview.totalQuestionsPlanned;

    // Complete if time ran out OR all planned questions answered
    if (isTimerExpired || allQuestionsAnswered) {
      interview.status = 'completed';
      interview.endedAt = new Date();
      interview.actualDurationSeconds = interview.durationMinutes * 60;
      await interview.save();

      return res.json({
        success: true,
        data: {
          questionAnswered: questionNumber,
          isInterviewComplete: true,
          totalAnswered: interview.questionsAnswered,
          totalQuestions: interview.totalQuestionsPlanned,
        },
        message: allQuestionsAnswered
          ? `Interview complete! All ${interview.totalQuestionsPlanned} questions answered.`
          : 'Interview complete! Time duration expired.'
      });
    }

    // 4. Generate Next Question On-The-Fly
    let nextQuestion = await Question.findOne({
      interviewId: id,
      questionNumber: interview.currentQuestionIndex + 1,
    });

    if (!nextQuestion) {
      const prevQuestions = await Question.find({ interviewId: id });
      const nextQData = await generateSingleQuestion({
        role: interview.role,
        interviewType: interview.interviewType,
        difficulty: interview.difficulty,
        durationMinutes: interview.durationMinutes,
        candidateProfile: interview.candidateProfileId,
        company: interview.company,
        questionNumber: interview.currentQuestionIndex + 1,
        previousQuestions: prevQuestions,
      });

      const normalizedQ = normalizeQuestionPayload(nextQData);
      nextQuestion = new Question({
        interviewId: interview._id,
        topic: normalizedQ.topic,
        subtopic: normalizedQ.subtopic,
        difficulty: normalizedQ.difficulty,
        question: normalizedQ.question,
        expectedConcepts: normalizedQ.expectedConcepts,
        estimatedAnswerSeconds: normalizedQ.estimatedAnswerSeconds,
        followUpQuestions: normalizedQ.followUpQuestions,
        questionNumber: interview.currentQuestionIndex + 1,
        status: 'pending',
      });
      await nextQuestion.save();
    }

    res.json({
      success: true,
      data: {
        questionAnswered: questionNumber,
        nextQuestionNumber: nextQuestion.questionNumber,
        totalAnswered: interview.questionsAnswered,
        totalQuestions: interview.totalQuestionsPlanned,
        isInterviewComplete: false,
      },
      message: 'Answer recorded successfully'
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

    // Get all answered questions for summary
    const answeredQuestions = await Question.find({
      interviewId: id,
      status: 'answered',
    });

    // Calculate overall score from answered questions
    if (answeredQuestions.length > 0) {
      // Only count questions that actually have AI feedback as "scored"
      const scoredQuestions = answeredQuestions.filter(q => q.feedback && q.feedback.length > 0 && typeof q.score === 'number');
      if (scoredQuestions.length > 0) {
        const totalScore = scoredQuestions.reduce((sum, q) => sum + q.score, 0);
        interview.overallScore = Math.round(totalScore / scoredQuestions.length);
      } else {
        // No AI scores yet - calculate based on completion ratio
        const allQuestions = await Question.find({ interviewId: id });
        const completionRatio = answeredQuestions.length / Math.max(allQuestions.length, 1);
        interview.overallScore = Math.round(completionRatio * 60); // Base score on completion ratio (max 60% without AI grading)
      }
    } else {
      interview.overallScore = 0;
    }

    // Identify weak topics (questions with score < 50 or skipped)
    const allQuestions = await Question.find({ interviewId: id });
    const weakTopicMap = {};
    for (const q of allQuestions) {
      const isWeak = q.status === 'skipped' || (typeof q.score === 'number' && q.score < 50);
      if (isWeak && q.topic) {
        weakTopicMap[q.topic] = (weakTopicMap[q.topic] || 0) + 1;
      }
    }
    interview.weakTopics = Object.entries(weakTopicMap).map(([topic, count]) => ({ topic, count }));
    interview.questionsAnswered = answeredQuestions.length;

    await interview.save();

    logger.info('[InterviewController] Interview completed', {
      interviewId: id,
      actualDurationSeconds,
      questionsAnswered: answeredQuestions.length,
      overallScore: interview.overallScore,
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

    const remainingSeconds = calculateRemainingSeconds(interview.startedAt, interview.durationMinutes);
    if (remainingSeconds <= 0 && interview.status === 'in_progress') {
      interview.status = 'completed';
      interview.endedAt = new Date();
      interview.actualDurationSeconds = interview.durationMinutes * 60;
      await interview.save();
      return res.status(400).json({
        success: false,
        message: 'Interview time has expired. The interview is now complete.',
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

/**
 * DELETE /api/interviews/:id
 * Permanently delete an interview and all its questions.
 */
exports.deleteInterview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await Interview.findById(id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found',
      });
    }

    if (interview.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this interview',
      });
    }

    // Delete all associated questions
    await Question.deleteMany({ interviewId: id });

    // Delete the interview itself
    await Interview.findByIdAndDelete(id);

    logger.info('[InterviewController] Interview deleted successfully', {
      interviewId: id,
      userId: req.user.id,
    });

    res.json({
      success: true,
      message: 'Interview and all associated questions deleted successfully',
    });
  } catch (error) {
    logger.error('[InterviewController] deleteInterview error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting interview',
    });
  }
});

module.exports = {
  ...exports,
  calculateRemainingSeconds,
  normalizeQuestionPayload,
  summarizeInterviewProgress,
};
