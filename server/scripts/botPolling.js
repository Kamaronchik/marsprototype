// Runs the bot on this computer: asks Telegram for new messages every few seconds.
// A website running on localhost cannot receive Telegram's calls, so this is for development.
//   npm run bot
// Do not run it while the webhook is set: it switches the webhook off first.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { getUpdates, deleteWebhook, getMe } = require('../services/telegram');
const { handleUpdate } = require('../utils/telegramBot');

const RETRY_MS = 5 * 1000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const me = await getMe();
  await deleteWebhook();
  console.log(`Bot @${me.username} is listening. Press Ctrl+C to stop.`);

  let offset = 0;
  for (;;) {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error(error.message);
      await wait(RETRY_MS);
    }
  }
})();
