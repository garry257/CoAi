const express = require('express');
const researchController = require('../controllers/research.controller');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all research routes
router.use(authMiddleware);

// Endpoint to run the research agent
router.post('/query', researchController.queryResearchAgent);

module.exports = router;
