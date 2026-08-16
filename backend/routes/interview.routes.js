const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interview.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

/**
 * Interview Management Routes
 */

// Create new interview
router.post('/', interviewController.createInterview);

// List all interviews for user
router.get('/', interviewController.listInterviews);

// Get specific interview with all details
router.get('/:id', interviewController.getInterview);

// Start interview and generate questions
router.post('/:id/start', interviewController.startInterview);

// Get current question for ongoing interview
router.get('/:id/current-question', interviewController.getCurrentQuestion);

// Submit answer to a question
router.post('/:id/answer', interviewController.submitAnswer);

// Skip current question
router.post('/:id/skip-question', interviewController.skipQuestion);

// Complete interview
router.post('/:id/complete', interviewController.completeInterview);

// Delete interview
router.delete('/:id', interviewController.deleteInterview);

module.exports = router;
