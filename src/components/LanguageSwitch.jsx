import { useTranslation } from 'react-i18next';

const LANGUAGES = ['ru', 'uz', 'en'];

// The chosen language is remembered by i18next in the browser, so it survives a reload.
const LanguageSwitch = () => {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || 'ru').slice(0, 2);

  return (
    <div role="group" aria-label={t('language.label')} className="flex gap-1">
      {LANGUAGES.map((code) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          aria-pressed={current === code}
          className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${
            current === code ? 'bg-ink text-card' : 'text-ink-soft hover:bg-card hover:text-ink'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitch;
