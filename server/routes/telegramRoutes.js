const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { limiter } = require('../utils/rateLimit');
const { createLink, getStatus, unlink, webhook } = require('../controllers/telegramController');

const linkLimiter = limiter(20, 'Too many connection attempts. Please wait.');

// The student connects or disconnects Telegram from the profile.
router.get('/status', authMiddleware, requireRole('Student'), getStatus);
router.post('/link', authMiddleware, requireRole('Student'), linkLimiter, createLink);
router.delete('/link', authMiddleware, requireRole('Student'), unlink);

// Telegram calls this itself. No cookie: the secret header is checked inside.
router.post('/webhook', webhook);

module.exports = router;
