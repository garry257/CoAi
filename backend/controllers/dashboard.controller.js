const mongoose = require('mongoose');
const Interview = require('../models/interview.model');
const Question = require('../models/question.model');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');

function normalizeTopic(topicStr) {
  if (!topicStr) return 'General';
  const clean = topicStr.toLowerCase();
  
  // List of broad categories to group into
  const categories = [
    { name: 'Java', keywords: ['java', 'spring', 'springboot', 'hibernate', 'jvm'] },
    { name: 'React', keywords: ['react', 'redux', 'hooks', 'jsx'] },
    { name: 'JavaScript', keywords: ['javascript', 'js', 'es6', 'typescript', 'ts'] },
    { name: 'Node.js', keywords: ['node', 'nodejs', 'express'] },
    { name: 'Python', keywords: ['python', 'django', 'flask'] },
    { name: 'SQL & Databases', keywords: ['sql', 'database', 'mysql', 'postgres', 'mongodb', 'nosql', 'db'] },
    { name: 'HTML & CSS', keywords: ['html', 'css', 'sass', 'style', 'flexbox', 'grid'] },
    { name: 'REST & APIs', keywords: ['rest', 'api', 'http', 'graphql', 'soap'] },
    { name: 'DevOps & Cloud', keywords: ['aws', 'docker', 'kubernetes', 'cloud', 'devops', 'ci/cd', 'git'] },
    { name: 'Data Structures & Algorithms', keywords: ['algorithm', 'dsa', 'data structure', 'binary', 'tree', 'graph', 'sort'] },
    { name: 'System Design', keywords: ['system design', 'architecture', 'microservice', 'scaling'] },
    { name: 'Behavioral & HR', keywords: ['behavioral', 'hr', 'soft skill', 'conflict', 'culture', 'teamwork', 'leadership'] }
  ];

  for (const cat of categories) {
    for (const kw of cat.keywords) {
      if (clean.includes(kw)) {
        return cat.name;
      }
    }
  }

  // Fallback: return the first word capitalized
  const firstWord = topicStr.split(/[/\s-]/)[0];
  if (firstWord.length > 2) {
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }
  return topicStr;
}

/**
 * GET /api/dashboard/summary
 * Returns aggregate stats for the authenticated user's dashboard.
 */
exports.getSummary = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);

  // Auto-complete stuck interviews (answered all questions but status is in_progress)
  const stuckInterviews = await Interview.find({
    userId,
    status: 'in_progress',
    $expr: { $gte: ['$questionsAnswered', '$totalQuestionsPlanned'] }
  });

  for (const interview of stuckInterviews) {
    const startedAt = interview.startedAt || new Date();
    const actualDurationSeconds = Math.floor((Date.now() - new Date(startedAt)) / 1000);
    interview.status = 'completed';
    interview.endedAt = new Date();
    interview.actualDurationSeconds = actualDurationSeconds;

    const answeredQuestions = await Question.find({
      interviewId: interview._id,
      status: 'answered',
    });

    if (answeredQuestions.length > 0) {
      const scoredQuestions = answeredQuestions.filter(q => q.feedback && q.feedback.length > 0 && typeof q.score === 'number');
      if (scoredQuestions.length > 0) {
        const totalScore = scoredQuestions.reduce((sum, q) => sum + q.score, 0);
        interview.overallScore = Math.round(totalScore / scoredQuestions.length);
      } else {
        const allQuestions = await Question.find({ interviewId: interview._id });
        const completionRatio = answeredQuestions.length / Math.max(allQuestions.length, 1);
        interview.overallScore = Math.round(completionRatio * 60);
      }
    } else {
      interview.overallScore = 0;
    }

    const allQuestions = await Question.find({ interviewId: interview._id });
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
  }

  // Count completed interviews
  const totalInterviews = await Interview.countDocuments({
    userId,
    status: 'completed',
  });

  // Calculate average score across completed interviews
  let averageScore = 0;
  if (totalInterviews > 0) {
    const scoreAgg = await Interview.aggregate([
      { $match: { userId, status: 'completed' } },
      { $group: { _id: null, avgScore: { $avg: '$overallScore' } } },
    ]);
    averageScore = scoreAgg.length > 0 ? Math.round(scoreAgg[0].avgScore) : 0;
  }

  // Aggregate weak topics from all completed interviews
  const weakTopicsAgg = await Interview.aggregate([
    { $match: { userId, status: 'completed' } },
    { $unwind: { path: '$weakTopics', preserveNullAndEmptyArrays: false } },
    { $group: { _id: '$weakTopics.topic', totalCount: { $sum: '$weakTopics.count' }, interviewType: { $first: '$interviewType' } } },
    { $sort: { totalCount: -1 } },
  ]);

  // Normalize and group topics (e.g. group all Java Collections/Exceptions under 'Java')
  const weakTopicsMap = {};
  for (const w of weakTopicsAgg) {
    const normalized = normalizeTopic(w._id);
    weakTopicsMap[normalized] = (weakTopicsMap[normalized] || 0) + w.totalCount;
  }

  const weakTopics = Object.entries(weakTopicsMap)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const weakTopicsCount = weakTopics.length;

  // Recent interviews (last 5)
  const recentInterviews = await Interview.find({ userId, status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('role interviewType status overallScore createdAt durationMinutes');

  return apiResponse.success(res, {
    totalInterviews,
    averageScore,
    weakTopicsCount,
    weakTopics,
    recentInterviews,
  });
});

/**
 * GET /api/dashboard/progress
 * Returns interview score history for chart rendering.
 */
exports.getProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get all completed interviews with scores, ordered by date
  const progress = await Interview.find({
    userId,
    status: 'completed',
  })
    .sort({ createdAt: 1 })
    .select('role interviewType overallScore createdAt');

  const progressData = progress.map((interview) => ({
    date: interview.createdAt,
    score: interview.overallScore,
    type: interview.interviewType,
    role: interview.role,
  }));

  return apiResponse.success(res, { progress: progressData });
});

/**
 * DELETE /api/dashboard/weak-topics/:topic
 * Removes a normalized weak topic (and all matching subtopics) from the user's completed interviews.
 */
exports.deleteWeakTopic = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const targetTopic = req.params.topic;

  try {
    const interviews = await Interview.find({ userId, status: 'completed' });
    let updated = 0;

    for (const interview of interviews) {
      if (interview.weakTopics && interview.weakTopics.length > 0) {
        const originalLength = interview.weakTopics.length;
        // Filter out any weak topic that normalizes to targetTopic
        interview.weakTopics = interview.weakTopics.filter(
          (wt) => normalizeTopic(wt.topic) !== targetTopic
        );

        if (interview.weakTopics.length !== originalLength) {
          await interview.save();
          updated++;
        }
      }
    }

    return apiResponse.success(res, {
      message: `Successfully removed weak topic ${targetTopic} from ${updated} interviews`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error deleting weak topic',
    });
  }
});
