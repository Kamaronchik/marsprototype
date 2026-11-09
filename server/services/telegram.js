const API = 'https://api.telegram.org';
const TIMEOUT_MS = 15 * 1000;

// One call to the Telegram Bot API. Returns the "result" field or throws with Telegram's explanation.
const call = async (method, body = {}) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');

  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await response.json().catch(() => null);
  if (!json?.ok) throw new Error(`Telegram ${method} failed: ${json?.description ?? response.status}`);
  return json.result;
};

// keyboard: rows of button texts shown under the input field, e.g. [['Coins', 'Attendance']].
// inline: rows of { text, data } buttons attached to the message itself.
const sendMessage = (chatId, text, { keyboard, inline } = {}) => {
  const replyMarkup = inline
    ? { inline_keyboard: inline.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) }
    : keyboard
      ? { keyboard: keyboard.map((row) => row.map((text) => ({ text }))), resize_keyboard: true }
      : undefined;
  return call('sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup });
};

const answerCallback = (callbackId) => call('answerCallbackQuery', { callback_query_id: callbackId });

const getUpdates = (offset, timeout = 25) => call('getUpdates', { offset, timeout, allowed_updates: ['message', 'callback_query'] });

const setWebhook = (url, secret) => call('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'] });

const deleteWebhook = () => call('deleteWebhook');

const getMe = () => call('getMe');

module.exports = { sendMessage, answerCallback, getUpdates, setWebhook, deleteWebhook, getMe };
