import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Each language is its own file that the browser downloads only when it is needed
// (the language of the visitor first, the others if they switch).
const loaders = {
  ru: () => import('./locales/ru.json'),
  en: () => import('./locales/en.json'),
  uz: () => import('./locales/uz.json'),
};

const loaded = new Set(); // not hasResourceBundle: the admin editor can add single texts to a language first

export const loadLanguage = async (lng) => {
  const code = loaders[lng] ? lng : 'ru';
  if (loaded.has(code)) return;
  const file = await loaders[code]();
  loaded.add(code);
  // overwrite stays off: texts the admin changed (see overrides.js) must not be replaced.
  i18n.addResourceBundle(code, 'translation', file.default.translation, true, false);
};

const changeLanguage = i18n.changeLanguage.bind(i18n);
// Switching the language first fetches its texts, so the screen never shows raw keys.
i18n.changeLanguage = async (lng, callback) => {
  if (lng) await loadLanguage(lng.slice(0, 2));
  return changeLanguage(lng, callback);
};

i18n.use(LanguageDetector).use(initReactI18next);

// main.jsx waits for this before drawing the first screen.
export const i18nReady = i18n
  .init({
    resources: {},
    supportedLngs: ['ru', 'en', 'uz'],
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
    // Screens redraw when the admin changes a text (addResource).
    react: { bindI18nStore: 'added' },
  })
  .then(() => loadLanguage((i18n.resolvedLanguage || i18n.language || 'ru').slice(0, 2)))
  .then(() => i18n.changeLanguage(i18n.resolvedLanguage || 'ru'));

export default i18n;
