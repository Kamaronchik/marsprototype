const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { listSubjects, createSubject, updateSubject, deleteSubject } = require('../controllers/subjectController');

router.use(authMiddleware);

router.get('/', requireRole('Admin', 'AcademicManager', 'Teacher'), listSubjects);

// Admin and Academic Manager manage the subjects.
router.post('/', requireRole('Admin', 'AcademicManager'), createSubject);
router.patch('/:id', requireRole('Admin', 'AcademicManager'), updateSubject);
router.delete('/:id', requireRole('Admin', 'AcademicManager'), deleteSubject);

module.exports = router;
