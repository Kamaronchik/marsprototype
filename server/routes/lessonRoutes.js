const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { getToday, createLesson, listLessons } = require('../controllers/lessonController');

router.use(authMiddleware);

router.get('/today', requireRole('Teacher'), getToday);
router.post('/', requireRole('Teacher', 'Admin'), createLesson);
router.get('/', requireRole('Admin', 'AcademicManager'), listLessons);

module.exports = router;
