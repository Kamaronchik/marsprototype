const express = require('express');
const router = express.Router();
const { login, verifyDevice, resendCode, logout, me, getDevices, revokeDevice } = require('../controllers/authController');

router.post('/login', login);
router.post('/verify-device', verifyDevice);
router.post('/resend-code', resendCode);
router.post('/logout', logout);
router.get('/me', me);
router.get('/devices', getDevices);
router.delete('/devices/:deviceId', revokeDevice);

module.exports = router;
