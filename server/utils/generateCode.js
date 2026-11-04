const crypto = require('crypto');

const generateSixDigitCode = () => {
  // Generate a secure random 6-digit code
  return crypto.randomInt(100000, 999999).toString();
};

module.exports = { generateSixDigitCode };
