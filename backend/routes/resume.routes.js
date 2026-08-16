const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resume.controller');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload.middleware');

// All routes require authentication
router.use(authMiddleware);

// Resume routes
router.post(
  '/',
  upload.single('resume'), // field name must be "resume" in the form
  resumeController.uploadAndAnalyze
);
router.get('/my', resumeController.getMyResumes);
router.get('/:id', resumeController.getResume);

module.exports = router;
