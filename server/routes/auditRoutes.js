const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { listAudit, listAuditUsers } = require('../controllers/auditController');

// Admin sees everything; the Academic Manager and the Financier see only their own area (filtered in the controller).
router.use(authMiddleware, requireRole('Admin', 'AcademicManager', 'Financier'));

router.get('/', listAudit);
router.get('/users', listAuditUsers);

module.exports = router;
