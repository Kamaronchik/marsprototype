const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/deviceMiddleware');
const {
  getWallet, listTransactions, awardCoins, getTeacherPool, listTeacherPools, grantTeacherCoins,
} = require('../controllers/walletController');

router.get('/', authMiddleware, requireRole('Student'), getWallet);
router.get('/transactions', authMiddleware, requireRole('Student'), listTransactions);
router.post('/award', authMiddleware, requireRole('Teacher', 'Admin'), awardCoins);

router.get('/pool', authMiddleware, requireRole('Teacher'), getTeacherPool);
router.get('/teachers', authMiddleware, requireRole('Admin'), listTeacherPools);
router.post('/grant', authMiddleware, requireRole('Admin'), grantTeacherCoins);

module.exports = router;
