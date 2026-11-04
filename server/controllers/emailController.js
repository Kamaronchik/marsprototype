const { generateSixDigitCode } = require('../utils/generateCode');
const { sendVerificationEmail } = require('../services/emailService');

// In-memory storage for MVP.
// In production, this should be Redis or a DB.
const verificationCodes = new Map();
const attemptLimits = new Map();

const sendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    // Rate limiting per email
    const now = Date.now();
    const userAttempts = attemptLimits.get(email) || { count: 0, lastSent: 0 };

    if (now - userAttempts.lastSent < 60000) {
      return res.status(429).json({ message: 'Please wait 1 minute before requesting a new code' });
    }

    const code = generateSixDigitCode();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes

    verificationCodes.set(email, { code, expiresAt });
    attemptLimits.set(email, { count: userAttempts.count + 1, lastSent: now });

    await sendVerificationEmail(email, code);

    res.status(200).json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('SendCode Error:', error);
    res.status(500).json({ message: 'Failed to send verification email' });
  }
};

const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const record = verificationCodes.get(email);
    if (!record) {
      return res.status(400).json({ message: 'No verification code requested for this email' });
    }

    if (Date.now() > record.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({ message: 'Code has expired. Please request a new one' });
    }

    if (record.code !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Success
    verificationCodes.delete(email);
    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('VerifyCode Error:', error);
    res.status(500).json({ message: 'Internal server error during verification' });
  }
};

module.exports = { sendCode, verifyCode };
