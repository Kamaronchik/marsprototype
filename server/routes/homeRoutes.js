const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { getStudentHome } = require('../controllers/homeController');

// The home screens: one request each, so the page opens fast.
router.get('/student', authMiddleware, requireRole('Student'), getStudentHome);

module.exports = router;
