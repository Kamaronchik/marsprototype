const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const owner = require('../controllers/ownerController');

// The CEO panel (role Owner). The auditor (role Auditor) may only read the journal and the violations.
// Everything that is opened here is written to the journal.
router.use(authMiddleware, requireRole('Owner', 'Auditor'), owner.logOwnerView);

const ceoOnly = requireRole('Owner');

// Reading: CEO and auditors
router.get('/overview', owner.overview);
router.get('/log', owner.listLog);
router.get('/log/export', owner.exportLog);
router.get('/history/:entity/:id', owner.entityHistory);
router.get('/violations', owner.listViolations);
router.get('/violations/:id', owner.getViolation);
router.get('/staff', owner.listStaff);
router.get('/staff/:id', owner.getStaff);

// Changing: CEO only
router.get('/rules', ceoOnly, owner.listRules);
router.put('/rules/:code', ceoOnly, owner.updateRule);
router.post('/rules/run', ceoOnly, owner.runRules);
router.post('/violations/:id/acknowledge', ceoOnly, owner.acknowledge);
router.post('/violations/:id/close', ceoOnly, owner.closeViolation);

router.get('/accounts', ceoOnly, owner.listAccounts);
router.post('/accounts', ceoOnly, owner.createAccount);
router.patch('/accounts/:id', ceoOnly, owner.updateAccount);

module.exports = router;
