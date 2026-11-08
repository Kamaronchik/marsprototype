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

// Students of a group: the admin, or the head teacher of that group (checked in the controller).
router.get('/:id/students', requireRole('Admin', 'Teacher'), listGroupStudents);

// Everything else: Admin only.
router.use(requireRole('Admin'));

router.get('/options', getOptions);
router.get('/', listGroups);
router.post('/', createGroup);
router.patch('/:id', updateGroup);
router.delete('/:id', archiveGroup);
router.post('/:id/students', addStudent);
router.delete('/:id/students/:studentId', removeStudent);

module.exports = router;
