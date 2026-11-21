const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const {
  createHomework, listTeacherHomework, listSubmissions, gradeSubmission, archiveHomework, listMyHomework, submitHomework,
} = require('../controllers/homeworkController');

router.use(authMiddleware);

// Student
router.get('/mine', requireRole('Student'), listMyHomework);
router.post('/:id/submit', requireRole('Student'), submitHomework);

// Teacher (own groups) and admin. The academic manager may only look (GET).
router.get('/', requireRole('Teacher', 'Admin', 'AcademicManager'), listTeacherHomework);
router.post('/', requireRole('Teacher', 'Admin'), createHomework);
router.get('/:id/submissions', requireRole('Teacher', 'Admin', 'AcademicManager'), listSubmissions);
router.patch('/submissions/:id/grade', requireRole('Teacher', 'Admin'), gradeSubmission);
router.delete('/:id', requireRole('Teacher', 'Admin'), archiveHomework);

module.exports = router;
