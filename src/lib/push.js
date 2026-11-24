import { api } from './api';

// Browser push notifications through Firebase Cloud Messaging.
// Firebase is loaded only when it is needed (import(...)), so the site stays light for everybody else.
// The values below are public (Firebase web config), they are not secrets. They live in .env as VITE_FIREBASE_*.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const TOKEN_KEY = 'mars:push-token';

const readSaved = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const writeSaved = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private window: nothing to remember */ }
};

// Can this browser get pushes at all (and is Firebase set up)?
export const pushAvailable = async () => {
  if (!config.apiKey || !config.projectId || !vapidKey || !('Notification' in window)) return false;
  const { isSupported } = await import('firebase/messaging');
  return isSupported();
};

export const pushPermission = () => ('Notification' in window ? Notification.permission : 'denied');

let messaging = null;
const getFcm = async () => {
  if (messaging) return messaging;
  const { initializeApp } = await import('firebase/app');
  const { getMessaging } = await import('firebase/messaging');
  messaging = getMessaging(initializeApp(config));
  return messaging;
};

// Asks the browser for permission (only the first time), gets the Firebase token and gives it to the server.
// Returns 'granted', 'denied' or 'default' (the person closed the question).
export const enablePush = async (language) => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const { getToken } = await import('firebase/messaging');
  const token = await getToken(await getFcm(), { vapidKey, serviceWorkerRegistration: registration });
  await api('/api/notifications/push-token', { method: 'POST', body: { token, language } });
  writeSaved(token);
  return 'granted';
};

// On logout: this browser stops getting pushes of this account.
export const forgetPush = async () => {
  const token = readSaved();
  if (!token) return;
  writeSaved(null);
  await api('/api/notifications/push-token', { method: 'DELETE', body: { token } }).catch(() => {});
};
