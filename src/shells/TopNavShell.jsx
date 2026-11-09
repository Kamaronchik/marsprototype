import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import Eyebrow from '../components/Eyebrow';
import { ShellTools, UserChip, LogoutButton } from './parts';

// TEACHER: COMMANDER'S STATION. A teacher has few pages, so there is no sidebar: the navigation
// is a row of tabs along the top and the page gets the full width below.
const TopNavShell = ({ menuItems }) => {
  const { t } = useTranslation();

  const tab = ({ isActive }) =>
    `flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap ${
      isActive ? 'border-mars text-mars' : 'border-transparent text-ink-soft hover:text-ink'
    }`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-1 px-5">
          <Link to="/teacher" className="flex items-center gap-3 py-3">
            <Logo />
            <span className="hidden border-l border-line pl-3 md:block"><Eyebrow>{t('eyebrow.teacher')}</Eyebrow></span>
          </Link>
          <nav className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto" aria-label={t('home.navigation')}>
            {menuItems.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.end ?? true} className={tab}>
                <item.icon size={16} strokeWidth={1.9} />
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 py-2">
            <ShellTools />
            <UserChip compact />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default TopNavShell;
