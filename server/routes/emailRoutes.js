const express = require('express');
const router = express.Router();
const { sendCode, verifyCode } = require('../controllers/emailController');

router.post('/send-code', sendCode);
router.post('/verify-code', verifyCode);

module.exports = router;
