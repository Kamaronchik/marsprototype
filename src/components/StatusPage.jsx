import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from './Logo';
import LanguageSwitch from './LanguageSwitch';

// Full-page message for 404 / forbidden. title and text are translation keys.
const StatusPage = ({ code, title, text }) => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-6 py-10">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <LanguageSwitch />
      </div>
      <div className="my-auto max-w-md py-10 text-center">
        <p className="font-display text-7xl font-semibold text-mars">{code}</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">{t(title)}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t(text)}</p>
        <Link to="/login" className="btn-primary mt-8">{t('status.back')}</Link>
      </div>
    </div>
  );
};

export default StatusPage;
