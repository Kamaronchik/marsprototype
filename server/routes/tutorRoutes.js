const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { limiter } = require('../utils/rateLimit');
const { ask } = require('../controllers/tutorController');

// Every question costs money at the AI service, so the number of questions is limited.
const askLimiter = limiter(60, 'Too many questions. Try again in 15 minutes.');

router.use(authMiddleware, requireRole('Student'));
router.post('/ask', askLimiter, ask);

module.exports = router;
