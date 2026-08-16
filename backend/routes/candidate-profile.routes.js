const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resume.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

// GET /api/candidate-profile/me
router.get('/me', resumeController.getCandidateProfile);

module.exports = router;
