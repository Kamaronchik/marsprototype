import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { homePath } from '../lib/roleHome';
import Logo from './Logo';
import LanguageSwitch from './LanguageSwitch';
import DesignSwitch from './DesignSwitch';

// Full-page message for 404 / no access. title and text are translation keys.
// A signed-in person goes back to their own cabinet, a visitor to the login page.
const StatusPage = ({ code, title, text }) => {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4"><DesignSwitch /><LanguageSwitch /></div>
      </div>
      <div className="my-auto max-w-md py-10 text-center">
        <p className="font-display text-7xl font-semibold text-mars">{code}</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">{t(title)}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{t(text)}</p>
        <Link to={isAuthenticated ? homePath(user?.role) : '/login'} className="btn-primary mt-8">
          {isAuthenticated ? t('status.toCabinet') : t('status.back')}
        </Link>
      </div>
    </div>
  );
};

export default StatusPage;
