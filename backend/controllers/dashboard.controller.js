const Interview = require('../models/Interview');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');

/**
 * GET /api/dashboard/summary
 * Returns aggregate stats for the authenticated user's dashboard.
 */
exports.getSummary = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Count completed interviews
  const totalInterviews = await Interview.countDocuments({
    userId,
    status: 'completed',
  });

  // Calculate average score across completed interviews
  let averageScore = 0;
  if (totalInterviews > 0) {
    const scoreAgg = await Interview.aggregate([
      { $match: { userId: req.user.id, status: 'completed' } },
      { $group: { _id: null, avgScore: { $avg: '$overallScore' } } },
    ]);
    averageScore = scoreAgg.length > 0 ? Math.round(scoreAgg[0].avgScore) : 0;
  }

  // Weak topics count (placeholder — computed properly in Phase 7)
  const weakTopicsCount = 0;

  // Study sessions count (placeholder — computed in Phase 8)
  const studySessions = 0;

  // Recent interviews (last 5)
  const recentInterviews = await Interview.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('role interviewType status overallScore createdAt durationMinutes');

  return apiResponse.success(res, {
    totalInterviews,
    averageScore,
    weakTopicsCount,
    studySessions,
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
