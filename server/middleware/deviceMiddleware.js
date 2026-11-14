const crypto = require('crypto');
const db = require('../databaseService');

const authMiddleware = async (req, res, next) => {
  const sessionToken = req.cookies.sessionId;

  if (!sessionToken) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Hash the token from cookie to match the database record
  const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
  let session;
  try {
    session = await db.getSession(sessionHash);
  } catch (error) {
    console.error('Session lookup failed:', error.message);
    return res.status(503).json({ message: 'Database error' });
  }

  if (!session) {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }

  if (new Date() > new Date(session.expires_at)) {
    await db.deleteSession(sessionHash);
    return res.status(401).json({ message: 'Session expired' });
  }

  // A blocked or frozen account has no access, even if an old session is still stored.
  const accountStatus = session.user?.status;
  if (accountStatus === 'blocked' || accountStatus === 'frozen') {
    await db.deleteSession(sessionHash);
    return res.status(401).json({ message: 'Account is not active' });
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

// Allow only the listed roles, e.g. router.use(authMiddleware, requireRole('Admin'))
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

module.exports = { authMiddleware, requireRole };
