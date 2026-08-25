const express = require('express');
const researchController = require('../controllers/research.controller');
const authMiddleware = require('../middleware/auth.middleware');
const checkGuardrails = require('../middleware/guardrails.middleware');

const router = express.Router();

// Apply auth middleware to all research routes
router.use(authMiddleware);

// Endpoint to run the research agent with guardrails screening
router.post('/query', checkGuardrails, researchController.queryResearchAgent);

module.exports = router;
