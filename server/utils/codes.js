const crypto = require('crypto');

// One-time email codes are stored only as an HMAC hash.
const hashCode = (code) => {
  if (!process.env.HMAC_SECRET) {
    throw new Error('HMAC_SECRET is not set in .env');
  }
  return crypto
    .createHmac('sha256', process.env.HMAC_SECRET)
    .update(code)
    .digest('hex');
};

const generateCode = () => crypto.randomInt(100000, 999999).toString();

module.exports = { hashCode, generateCode };
