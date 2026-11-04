const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Temporary in-memory stores (MVP).
// In production, move these to Redis or PostgreSQL.
const sessions = new Map(); // sessionId -> { userId, role, deviceId, expiresAt }
const trustedDevices = new Map(); // userId -> Set of deviceIds
const pending2FA = new Map(); // userId -> { code, expiresAt, attempts }

const generateSecureCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const generateSessionId = () => uuidv4();
const generateDeviceId = () => uuidv4();

module.exports = {
  sessions,
  trustedDevices,
  pending2FA,
  generateSecureCode,
  generateSessionId,
  generateDeviceId,
};
