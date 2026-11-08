// The one place that talks to the backend. A failed request throws an Error with
// the server message, plus .code (to pick a translation) and .status.
export const api = async (url, options = {}) => {
  const { body, ...rest } = options;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...rest,
    body: body === undefined || typeof body === 'string' || body instanceof Blob ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.code = data.code;
    error.status = res.status;
    throw error;
  }
  return data;
};

// Text for the user: the translation of the server error code, or the server message.
export const errorText = (t, error) =>
  (error.code ? t(`errors.${error.code}`, { defaultValue: error.message }) : error.message);
