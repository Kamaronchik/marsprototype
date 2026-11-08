const express = require('express');
const router = express.Router();
const { limiter } = require('../utils/rateLimit');

const loginLimiter = limiter(10, 'Too many login attempts. Try again in 15 minutes.');
const codeLimiter = limiter(10, 'Too many code attempts. Try again in 15 minutes.');
const { login, verifyDevice, resendCode, logout, me, getDevices, revokeDevice } = require('../controllers/authController');

router.post('/login', loginLimiter, login);
router.post('/verify-device', codeLimiter, verifyDevice);
router.post('/resend-code', codeLimiter, resendCode);
router.post('/logout', logout);
router.get('/me', me);
router.get('/devices', getDevices);
router.delete('/devices/:deviceId', revokeDevice);

module.exports = router;
