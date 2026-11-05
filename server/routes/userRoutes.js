const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { listUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');

// Every route here: logged in + role Admin.
router.use(authMiddleware, requireRole('Admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
