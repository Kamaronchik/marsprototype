const { sessions } = require('../utils/authStore'); // This will be deleted soon, keeping for structure
const crypto = require('crypto');
const db = require('../databaseService');

const authMiddleware = async (req, res, next) => {
  const sessionToken = req.cookies.sessionId;

  if (!sessionToken) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Hash the token from cookie to match the database record
  const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
  const session = await db.getSession(sessionHash);

  if (!session) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }

  if (new Date() > new Date(session.expires_at)) {
    await db.deleteSession(sessionHash);
    return res.status(401).json({ message: 'Session expired' });
  }

  // Device verification: ensure the current device matches the session's device
  const deviceToken = req.cookies.deviceId;
  if (!deviceToken) {
    return res.status(401).json({ message: 'Device identification missing' });
  }

  const deviceHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
  if (deviceHash !== session.device_id_hash) {
    return res.status(401).json({ message: 'Session bound to a different device' });
  }

  req.user = { id: session.user_id, role: session.role, deviceId: deviceHash };
  next();
};

module.exports = { authMiddleware };
