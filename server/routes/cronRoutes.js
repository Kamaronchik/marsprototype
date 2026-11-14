const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { runAttendanceRule } = require('../utils/violations');

// Called by a timer (Vercel Cron or any pinger) every few minutes: GET /api/cron/rules
// with the header  Authorization: Bearer <CRON_SECRET>. Without CRON_SECRET in .env it is switched off.
const sameSecret = (given, secret) => {
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
};

router.get('/rules', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ message: 'Cron is not configured' });
  if (!sameSecret((req.get('authorization') ?? '').replace(/^Bearer /, ''), secret)) {
    return res.status(401).json({ message: 'Invalid cron secret' });
  }
  try {
    res.json(await runAttendanceRule());
  } catch (error) {
    console.error('Cron rules error:', error.message);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;
