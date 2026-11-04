const supabase = require('./config/supabase');
const crypto = require('crypto');

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
        last_used_at: new Date().toISOString()
      }, { onConflict: 'user_id,device_id_hash' })
      .select()
      .single();
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

  async getSession(sessionIdHash) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, users(role)')
      .eq('session_hash', sessionIdHash)
      .maybeSingle();
    if (error || !data) return null;
    return { ...data, role: data.users?.role };
  },

  async deleteSession(sessionIdHash) {
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
