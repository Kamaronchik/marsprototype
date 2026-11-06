const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Brute-force protection (per IP, 15 minutes window).
const limiter = (max, message) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
});
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
