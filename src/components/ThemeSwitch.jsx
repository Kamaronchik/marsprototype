import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { THEMES, applyTheme, currentTheme } from '../lib/theme';

// Two-colour dots that show what each style looks like: its background and its accent.
const SWATCH = {
  mars: { background: '#F5EFE6', accent: '#B8431F' },
  orbit: { background: '#0A0C1C', accent: '#8B7CFF' },
  terminal: { background: '#0B0F0A', accent: '#46FF78' },
};

// Three buttons that change the look of the whole site. The choice is remembered in the browser.
const ThemeSwitch = () => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(currentTheme);

  const choose = (name) => {
    applyTheme(name);
    setTheme(name);
  };

  return (
    <div role="group" aria-label={t('theme.label')} className="flex items-center gap-2">
      {THEMES.map((name) => (
        <button
          key={name}
          onClick={() => choose(name)}
          aria-pressed={theme === name}
          title={t(`theme.${name}`)}
          aria-label={t(`theme.${name}`)}
          className={`relative h-7 w-7 overflow-hidden rounded-full border-2 transition-transform hover:scale-110 ${
            theme === name ? 'border-ink' : 'border-line'
          }`}
          style={{ background: `linear-gradient(135deg, ${SWATCH[name].background} 50%, ${SWATCH[name].accent} 50%)` }}
        />
      ))}
    </div>
  );
};

export default ThemeSwitch;
