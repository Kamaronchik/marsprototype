const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { limiter } = require('../utils/rateLimit');
const {
  getDashboard, getRiskStudents, getTeachers, transferStudent, assignTeacher, assignSubject, listTeacherNames, listStudents,
} = require('../controllers/academicController');
const { getReport, refreshReport, makeDraft, sendMessage } = require('../controllers/aiReportController');

// Every call to the AI costs money, so the number of calls is limited.
const aiLimiter = limiter(40, 'Too many AI requests. Try again in 15 minutes.');

router.use(authMiddleware, requireRole('Admin', 'AcademicManager'));

router.get('/dashboard', getDashboard);
router.get('/students/risk', getRiskStudents);
router.get('/students', listStudents);
router.get('/teachers', getTeachers);
router.get('/teacher-names', listTeacherNames);

router.post('/transfer', transferStudent);
router.patch('/groups/:id/teacher', assignTeacher);
router.patch('/groups/:id/subject', assignSubject);

router.get('/reports/:type/:id', getReport);
router.post('/reports/:type/:id/refresh', aiLimiter, refreshReport);
router.post('/draft', aiLimiter, makeDraft);
router.post('/send', sendMessage);

module.exports = router;
