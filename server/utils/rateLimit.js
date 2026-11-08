const rateLimit = require('express-rate-limit');

// Brute-force protection (per IP, 15 minutes window).
const limiter = (max, message) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
});

module.exports = { limiter };
