const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const {
  getOverview, listPayments, createPayment, remindDebtors, listTeachers, listSalaries, createSalary,
} = require('../controllers/financeController');

// Every route here: logged in + role Admin or Financier.
router.use(authMiddleware, requireRole('Admin', 'Financier'));

router.get('/overview', getOverview);
router.get('/payments', listPayments);
router.post('/payments', createPayment);
router.post('/remind-debtors', remindDebtors);
router.get('/teachers', listTeachers);
router.get('/salaries', listSalaries);
router.post('/salaries', createSalary);

module.exports = router;
