const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { addGrade, listGroupGrades, deleteGrade, listMyGrades } = require('../controllers/gradeController');

router.use(authMiddleware);

router.get('/mine', requireRole('Student'), listMyGrades);

router.post('/', requireRole('Teacher', 'Admin'), addGrade);
router.get('/group/:groupId', requireRole('Teacher', 'Admin', 'AcademicManager'), listGroupGrades);
router.delete('/:id', requireRole('Teacher', 'Admin'), deleteGrade);

module.exports = router;
