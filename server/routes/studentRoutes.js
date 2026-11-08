const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const { searchStudents, setPaymentStatus } = require('../controllers/studentController');

// Every route here: logged in + role Admin or Financier.
router.use(authMiddleware, requireRole('Admin', 'Financier'));

router.get('/', searchStudents);
router.patch('/:id/payment-status', setPaymentStatus);

module.exports = router;
