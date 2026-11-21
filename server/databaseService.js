const supabase = require('./config/supabase');
const crypto = require('crypto');

// Short on purpose: on Vercel every server instance has its own copy, so a block or role change
// reaches the other instances within this time.
const SESSION_CACHE_MS = 20 * 1000;
const sessionCache = new Map();

/**
 * Database Service for Mars Space
 * Replaces in-memory Maps with Supabase PostgreSQL queries.
 */
const db = {
  // --- USER OPERATIONS ---
  async findUserByUsername(username) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async findUserById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async createUser(userData) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateUserSettings(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // --- DEVICE TRUST OPERATIONS ---
  async isDeviceTrusted(userId, deviceIdHash) {
    const { data, error } = await supabase
      .from('trusted_devices')
      .select('id')
      .eq('user_id', userId)
      .eq('device_id_hash', deviceIdHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return false;
    return true;
  },

  async trustDevice(userId, deviceIdHash, deviceName = 'Unknown Device') {
    const { data, error } = await supabase
      .from('trusted_devices')
      .upsert({
        user_id: userId,
        device_id_hash: deviceIdHash,
        device_name: deviceName,
        last_used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'user_id,device_id_hash' })
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async revokeDevice(userId, deviceIdHash) {
    const { error } = await supabase
      .from('trusted_devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id_hash', deviceIdHash);
    if (error) throw error;
    return true;
  },

  // --- SESSION OPERATIONS ---
  async createSession(sessionId, userId, deviceIdHash, expiresAt) {
    const { error } = await supabase
      .from('sessions')
      .insert({
        session_hash: sessionId,
        user_id: userId,
        device_id_hash: deviceIdHash,
        expires_at: expiresAt.toISOString()
      });
    if (error) throw error;
    return true;
  },

  // Every API call checks the session, so it is kept in memory for a short time instead of
  // asking Supabase each time. Logout, block and role changes clear it (see clearSessionCache).
  async getSession(sessionIdHash) {
    const cached = sessionCache.get(sessionIdHash);
    if (cached && cached.until > Date.now()) return cached.session;

    const ask = () => supabase
      .from('sessions')
      .select('*, users(id, username, full_name, email, role, status)')
      .eq('session_hash', sessionIdHash)
      .maybeSingle();
    let { data, error } = await ask();
    // A hiccup of the connection is not "the session is gone": ask once more, and if the database still
    // does not answer, say so (the middleware answers 503) instead of signing the person out.
    if (error) ({ data, error } = await ask());
    if (error) throw error;
    if (!data) {
      sessionCache.delete(sessionIdHash);
      return null;
    }
    // The user comes in the same call, so /api/auth/me does not need a second trip to the database.
    const session = { ...data, role: data.users?.role, user: data.users };
    sessionCache.set(sessionIdHash, { session, until: Date.now() + SESSION_CACHE_MS });
    if (sessionCache.size > 2000) sessionCache.delete(sessionCache.keys().next().value);
    return session;
  },

  clearSessionCache() {
    sessionCache.clear();
  },

  async deleteSession(sessionIdHash) {
    sessionCache.delete(sessionIdHash);
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('session_hash', sessionIdHash);
    if (error) throw error;
    return true;
  },

  // --- 2FA OPERATIONS ---
  async saveVerificationCode(userId, codeHash, expiresAt) {
    // First, invalidate any existing codes for this user
    await supabase
      .from('verification_codes')
      .update({ is_used: true })
      .eq('user_id', userId);

    const { data, error } = await supabase
      .from('verification_codes')
      .insert({
        user_id: userId,
        code_hash: codeHash,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getVerificationCode(userId) {
    const { data, error } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  },

  // When was the newest code for this user created? (used for the resend cooldown)
  async getLastCodeTime(userId) {
    const { data } = await supabase
      .from('verification_codes')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? new Date(data.created_at).getTime() : 0;
  },

  async updateCodeAttempts(codeId, attempts) {
    const { error } = await supabase
      .from('verification_codes')
      .update({ attempts })
      .eq('id', codeId);
    if (error) throw error;
  },

  async markCodeUsed(codeId) {
    const { error } = await supabase
      .from('verification_codes')
      .update({ is_used: true })
      .eq('id', codeId);
    if (error) throw error;
  }
};

module.exports = db;
