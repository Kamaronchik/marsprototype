// Points Telegram at the deployed site, so the bot works without a computer running.
//   npm run bot-webhook -- https://your-site.vercel.app
// Run it once after deploying, and again only if the address changes.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { setWebhook } = require('../services/telegram');

(async () => {
  const site = process.argv[2];
  if (!site || !site.startsWith('https://')) return console.error('Give the site address: npm run bot-webhook -- https://your-site.vercel.app');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) return console.error('TELEGRAM_WEBHOOK_SECRET is not set in .env');

  await setWebhook(`${site.replace(/\/$/, '')}/api/telegram/webhook`, process.env.TELEGRAM_WEBHOOK_SECRET);
  console.log('Webhook is set. Messages to the bot now go to the site.');
})().catch((error) => console.error(error.message));
