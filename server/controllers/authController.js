const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const db = require('../databaseService');
const supabase = require('../config/supabase');

const hashCode = (code) => {
  if (!process.env.HMAC_SECRET) {
    throw new Error('HMAC_SECRET is not set in .env');
  }
  return crypto
    .createHmac('sha256', process.env.HMAC_SECRET)
    .update(code)
    .digest('hex');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const getCookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
  sameSite: 'lax',
  path: '/',
  maxAge: maxAgeMs,
});

const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // 1. Find user in Supabase
    const user = await db.findUserByUsername(String(username).trim());
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 2. Check status
    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Your account is blocked. Contact administrator.' });
    }

    // 3. Verify password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    // Admin logs in with username + password only: no email check and no Gmail 2FA,
    // even if an email is stored on the account.
    const noEmailAdmin = user.role === 'Admin';
    const emailMatch = noEmailAdmin ||
      (!!user.email && !!email && user.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!isMatch || !emailMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 4. Device Trust Check
    let deviceToken = req.cookies.deviceId;
    if (!deviceToken) {
      deviceToken = crypto.randomBytes(32).toString('hex');
      res.cookie('deviceId', deviceToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
    }

    const deviceHash = hashToken(deviceToken);
    const isTrusted = await db.isDeviceTrusted(user.id, deviceHash);

    if (isTrusted || noEmailAdmin) {
      // Trusted device (or Admin without email, who has nowhere to get a code): create the session directly
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionHash = hashToken(sessionToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.createSession(sessionHash, user.id, deviceHash, expiresAt);

      res.cookie('sessionId', sessionToken, getCookieOptions(24 * 60 * 60 * 1000));

      return res.status(200).json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          role: user.role
        }
      });
    }

    // 5. New Device: 2FA Flow
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.saveVerificationCode(user.id, codeHash, expiresAt);

    try {
      await emailService.sendVerificationEmail(user.email, code);
    } catch (emailError) {
      console.error('❌ [Auth:Login] Failed to send verification email to:', user.email, emailError.message);
      return res.status(500).json({
        message: 'Failed to send verification email. Please check server email configuration or Gmail credentials.',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

    res.status(200).json({
      message: 'New device detected. Verification code sent to email.',
      requires2FA: true,
      userId: user.id
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal server error during login' });
  }
};

const verifyDevice = async (req, res) => {
  try {
    const { userId, code } = req.body;
    let deviceToken = req.cookies.deviceId;

    // If deviceId cookie was not yet stored, issue and save it now
    if (!deviceToken) {
      deviceToken = crypto.randomBytes(32).toString('hex');
      res.cookie('deviceId', deviceToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
    }

    const deviceHash = hashToken(deviceToken);
    const record = await db.getVerificationCode(userId);

    if (!record) {
      return res.status(400).json({ message: 'No verification request found' });
    }

    if (Date.now() > new Date(record.expires_at).getTime()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    if (record.attempts >= 5) {
      return res.status(403).json({ message: 'Too many failed attempts. Please request a new code.' });
    }

    const inputHash = hashCode(code);
    if (record.code_hash !== inputHash) {
      await db.updateCodeAttempts(record.id, record.attempts + 1);
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Success: Mark device as trusted in database
    await db.trustDevice(userId, deviceHash, 'Verified Device');
    await db.markCodeUsed(record.id);
    await db.updateUserSettings(userId, { email_verified: true }); // the code reached this inbox

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await db.findUserById(userId);
    const role = user?.role || 'Student';

    await db.createSession(sessionHash, userId, deviceHash, expiresAt);

    res.cookie('sessionId', sessionToken, getCookieOptions(24 * 60 * 60 * 1000));

    res.status(200).json({
      message: 'Device verified successfully',
      user: {
        id: userId,
        username: user?.username || '',
        fullName: user?.full_name || '',
        email: user?.email || '',
        role: role
      }
    });
  } catch (error) {
    console.error('VerifyDevice Error:', error);
    res.status(500).json({ message: 'Internal server error during verification' });
  }
};

const resendCode = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // A new code can be requested once per minute (prevents email spam).
    const waitMs = 60 * 1000 - (Date.now() - await db.getLastCodeTime(user.id));
    if (waitMs > 0) {
      return res.status(429).json({ message: `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting a new code` });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.saveVerificationCode(user.id, codeHash, expiresAt);

    try {
      await emailService.sendVerificationEmail(user.email, code);
    } catch (emailError) {
      console.error('❌ [Auth:Resend] Failed to send verification email to:', user.email, emailError.message);
      return res.status(500).json({
        message: 'Failed to resend verification email. Please check server email configuration or Gmail credentials.',
        error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

    res.status(200).json({ message: 'Verification code resent successfully' });
  } catch (error) {
    console.error('ResendCode Error:', error);
    res.status(500).json({ message: 'Internal server error during code resend' });
  }
};

const logout = async (req, res) => {
  const sessionToken = req.cookies.sessionId;
  if (sessionToken) {
    const sessionHash = hashToken(sessionToken);
    await db.deleteSession(sessionHash);
  }
  res.clearCookie('sessionId', { path: '/' });
  res.status(200).json({ message: 'Logged out successfully' });
};

// Who is logged in? Always answers 200: {user} when there is a valid session, {user: null} when not.
// (A 401 here would only fill the browser console with red errors for every visitor.)
const me = async (req, res) => {
  const guest = () => res.status(200).json({ user: null });

  const sessionToken = req.cookies.sessionId;
  if (!sessionToken) return guest();

  const session = await db.getSession(hashToken(sessionToken));
  if (!session || new Date() > new Date(session.expires_at)) return guest();

  const user = await db.findUserById(session.user_id);
  if (!user || user.status === 'blocked') return guest();

  res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email || '',
      role: user.role
    }
  });
};

const getDevices = async (req, res) => {
  const sessionToken = req.cookies.sessionId;
  if (!sessionToken) return res.status(401).json({ message: 'Unauthorized' });

  const sessionHash = hashToken(sessionToken);
  const session = await db.getSession(sessionHash);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });

  const { data: devices, error } = await supabase
    .from('trusted_devices')
    .select('*')
    .eq('user_id', session.user_id);

  if (error) return res.status(500).json({ message: 'Error fetching devices' });
  res.status(200).json({ devices });
};

const revokeDevice = async (req, res) => {
  const { deviceIdHash } = req.body;
  const sessionToken = req.cookies.sessionId;
  if (!sessionToken) return res.status(401).json({ message: 'Unauthorized' });

  const sessionHash = hashToken(sessionToken);
  const session = await db.getSession(sessionHash);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });

  await db.revokeDevice(session.user_id, deviceIdHash);

  if (deviceIdHash === session.device_id_hash) {
    await db.deleteSession(sessionHash);
    res.clearCookie('sessionId', { path: '/' });
  }
  res.status(200).json({ message: 'Device trust revoked' });
};

module.exports = { login, verifyDevice, resendCode, logout, me, getDevices, revokeDevice };
