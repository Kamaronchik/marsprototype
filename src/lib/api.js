// The one place that talks to the backend. A failed request throws an Error with
// the server message, plus .code (to pick a translation) and .status.
export const api = async (url, options = {}) => {
  const { body, ...rest } = options;
  let res;
  try {
    res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...rest,
      body: body === undefined || typeof body === 'string' || body instanceof Blob ? body : JSON.stringify(body),
    });
  } catch {
    const error = new Error('No connection to the server');
    error.code = 'NETWORK';
    throw error;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.code = data.code;
    error.status = res.status;
    throw error;
  }
  return data;
};

// 'Group not found' -> 'group_not_found': the key of the message in the translation files (apiMessages).
export const messageKey = (message) => message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// A plain English message of the server, in the user's language.
export const messageText = (t, message) => t(`apiMessages.${messageKey(message)}`, { defaultValue: message });

// Text for the user: the translation of the error code, or of the server message.
export const errorText = (t, error) =>
  (error.code ? t(`errors.${error.code}`, { defaultValue: messageText(t, error.message) }) : messageText(t, error.message));
