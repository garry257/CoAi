const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/', chatController.getChats);
router.post('/', chatController.createChat);
router.post('/join', chatController.joinChatByCode);
router.get('/:id', chatController.getChatById);
router.post('/:id/messages', chatController.sendMessage);
router.delete('/:id', chatController.deleteChat);

module.exports = router;
