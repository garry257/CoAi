const express = require('express');
const ragController = require('../controllers/rag.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/health', ragController.health);
router.post('/ingest', ragController.ingest);
router.post('/retrieve', ragController.retrieve);
router.post('/context', ragController.previewContext);
router.post('/chunk', ragController.chunkPreview);
router.post('/question', ragController.generateQuestion);

module.exports = router;
