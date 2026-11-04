const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendVerificationEmail } = require('../services/emailService');
const db = require('../databaseService');
const supabase = require('../config/supabase');

const hashCode = (code) => {
  return crypto
    .createHmac('sha256', process.env.HMAC_SECRET || 'default-mars-secret-key')
    .update(code)
    .digest('hex');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Find user in Supabase
    const user = await db.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 2. Check status
    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Your account is blocked. Contact admin.' });
    }

    // 3. Verify password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // 4. Device Trust Check
    let deviceToken = req.cookies.deviceId;
    if (!deviceToken) {
      deviceToken = crypto.randomBytes(32).toString('hex');
      res.cookie('deviceId', deviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    const deviceHash = hashToken(deviceToken);
    const isTrusted = await db.isDeviceTrusted(user.id, deviceHash);

    if (isTrusted) {
      // Trusted: Create full session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionHash = hashToken(sessionToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.createSession(sessionHash, user.id, deviceHash, expiresAt);

      res.cookie('sessionId', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.status(200).json({
        message: 'Login successful',
        user: { id: user.id, fullName: user.full_name, role: user.role }
      });
    }

    // 5. New Device: 2FA Flow
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.saveVerificationCode(user.id, codeHash, expiresAt);
    await sendVerificationEmail(user.email, code);

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
    const deviceToken = req.cookies.deviceId;

    if (!deviceToken) {
      return res.status(400).json({ message: 'Device identification missing' });
    }

    const deviceHash = hashToken(deviceToken);
    const record = await db.getVerificationCode(userId);

    if (!record) {
      return res.status(400).json({ message: 'No verification request found' });
    }

    if (Date.now() > new Date(record.expires_at).getTime()) {
      return res.status(400).json({ message: 'Code has expired' });
    }

    if (record.attempts >= 5) {
      return res.status(403).json({ message: 'Too many failed attempts. Please request a new code' });
    }

    const inputHash = hashCode(code);
    if (record.code_hash !== inputHash) {
      await db.updateCodeAttempts(record.id, record.attempts + 1);
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Success: Mark device as trusted
    await db.trustDevice(userId, deviceHash, 'Verified Device');
    await db.markCodeUsed(record.id);

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Fetch user role for the session
    const user = await db.findUserById(userId);
    const role = user?.role || 'Student';

    await db.createSession(sessionHash, userId, deviceHash, expiresAt);

    res.cookie('sessionId', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: 'Device verified successfully',
      user: { id: userId, role: role }
    });
  } catch (error) {
    console.error('VerifyDevice Error:', error);
    res.status(500).json({ message: 'Internal server error during verification' });
  }
};

const logout = async (req, res) => {
  const sessionToken = req.cookies.sessionId;
  if (sessionToken) {
    const sessionHash = hashToken(sessionToken);
    await db.deleteSession(sessionHash);
  }
  res.clearCookie('sessionId');
  res.status(200).json({ message: 'Logged out successfully' });
};

const me = async (req, res) => {
  const sessionToken = req.cookies.sessionId;
  if (!sessionToken) return res.status(401).json({ message: 'Unauthorized' });

  const sessionHash = hashToken(sessionToken);
  const session = await db.getSession(sessionHash);

  if (!session) return res.status(401).json({ message: 'Unauthorized' });

  res.status(200).json({ user: { id: session.user_id, role: session.role } });
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
  const { deviceIdHash } = req.body; // Pass the hash from frontend
  const sessionToken = req.cookies.sessionId;
  if (!sessionToken) return res.status(401).json({ message: 'Unauthorized' });

  const sessionHash = hashToken(sessionToken);
  const session = await db.getSession(sessionHash);
  if (!session) return res.status(401).json({ message: 'Unauthorized' });

  await db.revokeDevice(session.user_id, deviceIdHash);

  if (deviceIdHash === session.device_id_hash) {
    await db.deleteSession(sessionHash);
    res.clearCookie('sessionId');
  }
  res.status(200).json({ message: 'Device trust revoked' });
};

module.exports = { login, verifyDevice, logout, me, getDevices, revokeDevice };
