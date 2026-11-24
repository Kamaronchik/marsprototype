// Browser push notifications through Firebase Cloud Messaging.
// FIREBASE_SERVICE_ACCOUNT in .env = the whole service account JSON on one line (Firebase console ->
// Project settings -> Service accounts -> Generate new private key). Without it pushes are simply skipped.
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const supabase = require('../config/supabase');
const { pushText } = require('../utils/pushTexts');

let messaging = null;
let warned = false;

const getFcm = () => {
  if (messaging) return messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    if (!warned) console.warn('[Push] FIREBASE_SERVICE_ACCOUNT is not set: push notifications are off.');
    warned = true;
    return null;
  }
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) });
  messaging = getMessaging(app);
  return messaging;
};

// These answers mean the browser token is dead (the user blocked notifications or cleared the site).
const DEAD_TOKEN = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

// Sends one push to every browser of the user. Never throws: a push must not break the action.
const sendPush = async (userId, type, data, link) => {
  try {
    const fcm = getFcm();
    if (!fcm) return;

    const { data: rows, error } = await supabase.from('push_tokens').select('token, language').eq('user_id', userId);
    if (error) throw error;
    if (!rows.length) return;

    // Data-only message: our service worker (public/firebase-messaging-sw.js) shows it.
    const messages = rows.map((row) => {
      const { title, body } = pushText(row.language, type, data);
      return { token: row.token, data: { title, body, link: link ?? '/' } };
    });
    const result = await fcm.sendEach(messages);
    if (result.failureCount) {
      const codes = result.responses.filter((r) => !r.success).map((r) => r.error?.code);
      console.log(`[Push] ${result.successCount} of ${messages.length} delivered, errors: ${codes.join(', ')}`);
    }

    const dead = result.responses
      .map((response, i) => (!response.success && DEAD_TOKEN.includes(response.error?.code) ? rows[i].token : null))
      .filter(Boolean);
    if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);
  } catch (error) {
    console.error('Push error:', error.message);
  }
};

module.exports = { sendPush };
