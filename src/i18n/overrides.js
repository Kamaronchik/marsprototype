import i18n from './i18n';
import { api } from '../lib/api';

export const LANGUAGES = ['ru', 'uz', 'en'];

// Puts the texts that the admin changed over the texts that come with the site.
export const applyOverrides = (lang, overrides) => {
  for (const [key, value] of Object.entries(overrides)) {
    i18n.addResource(lang, 'translation', key, value);
  }
};

// Called once when the site opens. If the server cannot be reached, the bundled texts are used.
export const loadOverrides = () => Promise.all(LANGUAGES.map(async (lang) => {
  try {
    const { overrides } = await api(`/api/i18n/${lang}`);
    applyOverrides(lang, overrides);
  } catch {
    // Nothing to do: the site works with the bundled texts.
  }
}));
