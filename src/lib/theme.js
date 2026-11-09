// The three styles of the site. The name is written on <html data-theme="..."> and remembered
// in this browser. index.html applies it before the first paint; src/index.css defines the looks.
export const THEMES = ['mars', 'orbit', 'terminal'];
export const DEFAULT_THEME = 'mars';
const STORAGE_KEY = 'mars-theme';

export const currentTheme = () => {
  const name = document.documentElement.getAttribute('data-theme');
  return THEMES.includes(name) ? name : DEFAULT_THEME;
};

export const applyTheme = (name) => {
  if (!THEMES.includes(name)) return;
  document.documentElement.setAttribute('data-theme', name);
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Private mode: the style still changes, it just will not be remembered.
  }
};
