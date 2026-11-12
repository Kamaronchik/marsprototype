const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { getToday, markAttendance, listAttendance, listUnmarked, listMine } = require('../controllers/attendanceController');

router.use(authMiddleware);

router.get('/today', requireRole('Teacher'), getToday);
router.put('/mark', requireRole('Teacher', 'Admin'), markAttendance);
router.get('/', requireRole('Admin', 'Teacher', 'AcademicManager'), listAttendance);
router.get('/unmarked', requireRole('Admin', 'AcademicManager'), listUnmarked);
router.get('/mine', requireRole('Student'), listMine);

module.exports = router;
