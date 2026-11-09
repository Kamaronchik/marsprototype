const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { getOverview, getChat } = require('../controllers/telegramController');

// The admin's "Telegram" tab: who is connected, absence reasons and the conversations.
router.use(authMiddleware, requireRole('Admin'));
router.get('/', getOverview);
router.get('/chats/:userId', getChat);

module.exports = router;
