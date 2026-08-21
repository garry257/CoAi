const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply auth middleware to protect all chat routes
router.use(authMiddleware);

router.get('/', chatController.getChats);
router.post('/', chatController.createChat);
router.post('/join', chatController.joinChatByCode);
router.get('/:id', chatController.getChatById);
router.post('/:id/messages', chatController.sendMessage);
router.delete('/:id', chatController.deleteChat);

// RAG document routes
router.post('/:id/documents', chatController.upload.single('file'), chatController.uploadDocument);
router.delete('/:id/documents/:docId', chatController.deleteDocument);

module.exports = router;
