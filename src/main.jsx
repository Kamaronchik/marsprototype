import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import i18n, { i18nReady } from './i18n/i18n';
import { loadOverrides } from './i18n/overrides';
import { loadThemeFont } from './lib/theme';

loadThemeFont(document.documentElement.getAttribute('data-theme') || 'mars');

// Texts the admin changed come from the server: for the current language now, for another when it is chosen.
const language = () => (i18n.resolvedLanguage || i18n.language || 'ru').slice(0, 2);
i18n.on('languageChanged', () => loadOverrides(language()));

// The first screen is drawn once the texts of the visitor's language have arrived.
i18nReady.finally(() => {
  loadOverrides(language());
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
});
