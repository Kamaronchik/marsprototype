const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { listSchedule, createSlot, updateSlot, deleteSlot, listMine } = require('../controllers/scheduleController');

router.use(authMiddleware);

// Student and Teacher: their own week.
router.get('/mine', requireRole('Student', 'Teacher'), listMine);

// Everything else: Admin and Academic Manager.
router.use(requireRole('Admin', 'AcademicManager'));

router.get('/', listSchedule);
router.post('/', createSlot);
router.patch('/:id', updateSlot);
router.delete('/:id', deleteSlot);

module.exports = router;
