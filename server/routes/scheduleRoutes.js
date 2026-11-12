const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { listSchedule, createSlot, updateSlot, deleteSlot } = require('../controllers/scheduleController');

router.use(authMiddleware, requireRole('Admin', 'AcademicManager'));

router.get('/', listSchedule);
router.post('/', createSlot);
router.patch('/:id', updateSlot);
router.delete('/:id', deleteSlot);

module.exports = router;
