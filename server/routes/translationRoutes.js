const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { listOverrides, saveOverride, resetOverride } = require('../controllers/translationController');

// Everyone reads the changed texts (the login page needs them); only an admin changes them.
router.get('/:lang', listOverrides);
router.put('/', authMiddleware, requireRole('Admin'), saveOverride);
router.delete('/', authMiddleware, requireRole('Admin'), resetOverride);

module.exports = router;
