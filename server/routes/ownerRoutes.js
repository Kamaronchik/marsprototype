const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const owner = require('../controllers/ownerController');
const penalty = require('../controllers/penaltyController');

// The CEO panel (role Owner). The auditor (role Auditor) reads, gives penalties and takes them back.
router.use(authMiddleware, requireRole('Owner', 'Auditor'));

const ceoOnly = requireRole('Owner');

// Reading: CEO and auditors
router.get('/overview', owner.overview);
router.get('/violations', owner.listViolations);
router.get('/violations/:id', owner.getViolation);
router.get('/fines', owner.listFines);
router.get('/staff', owner.listStaff);
router.get('/staff/:id', owner.getStaff);

router.post('/password', owner.changeOwnPassword);

// Penalties by the rules of Mars: the auditor and the CEO give them. Taking one back is POST /violations/:id/close
// with outcome "dismissed" and a reason (the auditor may do only that; confirming is for the CEO).
router.get('/mars-rules', penalty.listMarsRules);
router.post('/penalties', penalty.issuePenalty);
router.post('/violations/:id/close', owner.closeViolation);

// Changing: CEO only
router.get('/rules', ceoOnly, owner.listRules);
router.put('/rules/:code', ceoOnly, owner.updateRule);
router.post('/rules/run', ceoOnly, owner.runRules);
router.post('/violations/:id/acknowledge', ceoOnly, owner.acknowledge);

router.post('/fines/:id/cancel', ceoOnly, owner.cancelFine);
router.post('/fines/:id/deduct', ceoOnly, owner.deductFine);

router.get('/accounts', ceoOnly, owner.listAccounts);
router.post('/accounts', ceoOnly, owner.createAccount);
router.patch('/accounts/:id', ceoOnly, owner.updateAccount);

module.exports = router;
