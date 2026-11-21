// One look for the whole site, in two colour modes: light and dark.
// The mode is a name on <html data-theme="light|dark">; src/index.css defines the colours.
// The first visit follows the computer's setting; after that the person's own choice is remembered.
// index.html applies the stored mode before the first paint, so there is no flash.
const KEY = 'mars-theme';
const MODES = ['light', 'dark'];
const CHANGED = 'mars-theme-changed';

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const systemMode = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// The mode that is on the page now.
export const currentMode = () => {
  const stored = read();
  return MODES.includes(stored) ? stored : systemMode();
};

export const applyMode = (mode) => {
  document.documentElement.setAttribute('data-theme', mode);
  window.dispatchEvent(new Event(CHANGED));
};

// A person picks light or dark.
export const chooseMode = (mode) => {
  if (!MODES.includes(mode)) return;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Private mode: the mode still changes, it just will not be remembered.
  }
  applyMode(mode);
};

export const subscribeToMode = (callback) => {
  window.addEventListener(CHANGED, callback);
  return () => window.removeEventListener(CHANGED, callback);
};
