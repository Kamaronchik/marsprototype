const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { getPending, rateLesson, listMine, listAll, sendPrompts } = require('../controllers/ratingController');

router.use(authMiddleware);

// Student: the weekly question and the answer.
router.get('/pending', requireRole('Student'), getPending);
router.post('/', requireRole('Student'), rateLesson);

// Teacher: answers about own lessons (anonymous).
router.get('/mine', requireRole('Teacher'), listMine);

// Academic manager and admin: all answers (anonymous) and the button that sends the weekly question.
router.get('/', requireRole('Admin', 'AcademicManager'), listAll);
router.post('/send-prompts', requireRole('Admin', 'AcademicManager'), sendPrompts);

module.exports = router;
