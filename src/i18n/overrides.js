import i18n from './i18n';
import { api } from '../lib/api';

export const LANGUAGES = ['ru', 'uz', 'en'];

// Puts the texts that the admin changed over the texts that come with the site.
export const applyOverrides = (lang, overrides) => {
  for (const [key, value] of Object.entries(overrides)) {
    i18n.addResource(lang, 'translation', key, value);
  }
};

const loadedOverrides = new Set();

// Texts the admin changed come from the server, one language at a time: the current one when the
// site opens, another one when the visitor switches. If the server cannot be reached, the bundled texts are used.
export const loadOverrides = async (lang) => {
  if (!LANGUAGES.includes(lang) || loadedOverrides.has(lang)) return;
  loadedOverrides.add(lang);
  try {
    const { overrides } = await api(`/api/i18n/${lang}`);
    applyOverrides(lang, overrides);
  } catch {
    loadedOverrides.delete(lang);
  }
};
