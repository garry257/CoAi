const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All dashboard routes require authentication
router.use(authMiddleware);

router.get('/summary', dashboardController.getSummary);
router.get('/progress', dashboardController.getProgress);
router.delete('/weak-topics/:topic', dashboardController.deleteWeakTopic);

module.exports = router;
