const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const {
  getOptions, listGroups, createGroup, updateGroup, archiveGroup,
  listGroupStudents, addStudent, removeStudent, listMyGroups,
} = require('../controllers/groupController');

router.use(authMiddleware);

// Teacher: own groups.
router.get('/mine', requireRole('Teacher'), listMyGroups);

// Students of a group: the admin, the academic manager, or the head teacher of that group (checked in the controller).
router.get('/:id/students', requireRole('Admin', 'Teacher', 'AcademicManager'), listGroupStudents);

// The academic manager may look at the groups (no prices) and at the room and time lists.
router.get('/options', requireRole('Admin', 'AcademicManager'), getOptions);
router.get('/', requireRole('Admin', 'AcademicManager'), listGroups);

// Everything else: Admin only.
router.use(requireRole('Admin'));

router.post('/', createGroup);
router.patch('/:id', updateGroup);
router.delete('/:id', archiveGroup);
router.post('/:id/students', addStudent);
router.delete('/:id/students/:studentId', removeStudent);

module.exports = router;
