const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/authMiddleware');

// All dashboard routes require authentication
router.use(authMiddleware);

router.get('/summary', dashboardController.getSummary);
router.get('/progress', dashboardController.getProgress);

module.exports = router;
