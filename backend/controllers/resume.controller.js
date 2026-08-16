const Resume = require('../models/resume.model');
const CandidateProfile = require('../models/candidate-profile.model');
const { extractTextFromPDF } = require('../services/resume/pdfExtractor');
const { analyzeResume } = require('../services/resume/resumeAnalyzer');
const asyncHandler = require('../utils/asyncHandler');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * POST /api/resumes
 * Upload PDF → extract text → Gemini analysis → save Resume + CandidateProfile
 */
exports.uploadAndAnalyze = asyncHandler(async (req, res) => {
  // multer puts the file on req.file
  if (!req.file) {
    return apiResponse.error(res, 'Please upload a PDF file', 400);
  }

  const userId = req.user.id;
  let resume = null;

  try {
    // Step 1: Extract text from PDF buffer
    const rawText = await extractTextFromPDF(req.file.buffer);

    // Step 2: Create Resume document (status: 'uploaded')
    resume = await Resume.create({
      userId,
      rawText,
      fileUrl: '',          // Cloudinary integration in future phase
      status: 'uploaded',
    });

    logger.info(`[ResumeCtrl] Resume created: ${resume._id} for user ${userId}`);

    // Step 3: Analyze with Gemini
    const analysisData = await analyzeResume(rawText);

    // Step 4: Upsert CandidateProfile (one profile per user, updated on re-upload)
    const candidateProfile = await CandidateProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          resumeId: resume._id,
          ...analysisData,
          validatedByBackend: true,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Step 5: Mark resume as parsed
    await Resume.findByIdAndUpdate(resume._id, { status: 'parsed' });

    logger.info(`[ResumeCtrl] Profile saved for user ${userId}`);

    return apiResponse.success(
      res,
      {
        resume: {
          _id: resume._id,
          status: 'parsed',
          createdAt: resume.createdAt,
          textLength: rawText.length,
        },
        candidateProfile,
      },
      'Resume uploaded and analyzed successfully',
      201
    );
  } catch (error) {
    // Mark resume as failed if it was created before the error
    if (resume?._id) {
      await Resume.findByIdAndUpdate(resume._id, { status: 'failed' }).catch(() => {});
    }
    throw error; // Let global error handler respond
  }
});

/**
 * GET /api/resumes/:id
 * Get a specific resume (must belong to the requesting user)
 */
exports.getResume = asyncHandler(async (req, res) => {
  const resume = await Resume.findById(req.params.id);

  if (!resume) {
    return apiResponse.error(res, 'Resume not found', 404);
  }

  // Security: ensure the resume belongs to the requesting user
  if (resume.userId.toString() !== req.user.id) {
    return apiResponse.error(res, 'Access denied', 403);
  }

  return apiResponse.success(res, resume);
});

/**
 * GET /api/candidate-profile/me
 * Get the current user's candidate profile (most recent)
 */
exports.getCandidateProfile = asyncHandler(async (req, res) => {
  const profile = await CandidateProfile.findOne({ userId: req.user.id })
    .populate('resumeId', 'status createdAt textLength');

  if (!profile) {
    return apiResponse.error(
      res,
      'No profile found. Please upload your resume first.',
      404
    );
  }

  return apiResponse.success(res, profile);
});

/**
 * GET /api/resumes/my
 * List all resumes for the current user
 */
exports.getMyResumes = asyncHandler(async (req, res) => {
  const resumes = await Resume.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .select('status createdAt textLength fileUrl');

  return apiResponse.success(res, { resumes });
});
