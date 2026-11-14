const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const owner = require('../controllers/ownerController');

// The owner's panel. Only the Owner role, and everything the owner opens is written to the journal.
router.use(authMiddleware, requireRole('Owner'), owner.logOwnerView);

router.get('/overview', owner.overview);
router.get('/log', owner.listLog);
router.get('/log/export', owner.exportLog);
router.get('/history/:entity/:id', owner.entityHistory);

router.get('/violations', owner.listViolations);
router.get('/violations/:id', owner.getViolation);
router.post('/violations/:id/acknowledge', owner.acknowledge);
router.post('/violations/:id/close', owner.closeViolation);

router.get('/staff', owner.listStaff);
router.get('/staff/:id', owner.getStaff);

router.get('/rules', owner.listRules);
router.put('/rules/:code', owner.updateRule);
router.post('/rules/run', owner.runRules);

module.exports = router;
