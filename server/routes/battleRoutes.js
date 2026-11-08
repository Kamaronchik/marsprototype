const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { limiter } = require('../utils/rateLimit');
const {
  getOptions, createAiBattle, createChallenge, listChallenges, cancelChallenge, acceptChallenge,
  getBattle, answerQuestion, getHistory, getAdminStats,
} = require('../controllers/battleController');

// Starting battles is limited, so nobody can flood the database with them.
const startLimiter = limiter(60, 'Too many battles started. Try again in 15 minutes.');

router.use(authMiddleware);

router.get('/stats', requireRole('Admin'), getAdminStats);

// Everything else is for students.
router.use(requireRole('Student'));

router.get('/options', getOptions);
router.get('/history', getHistory);
router.post('/ai', startLimiter, createAiBattle);
router.get('/challenges', listChallenges);
router.post('/challenges', startLimiter, createChallenge);
router.delete('/challenges/:id', cancelChallenge);
router.post('/challenges/:id/accept', acceptChallenge);
router.get('/:id', getBattle);
router.post('/:id/answer', answerQuestion);

module.exports = router;
