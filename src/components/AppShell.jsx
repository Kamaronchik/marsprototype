import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { logoutUser } from '../features/auth/authSlice';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import LanguageSwitch from './LanguageSwitch';
import ThemeSwitch from './ThemeSwitch';

// One shell for every role. Each layout only passes its own label and menu.
// sectionLabel and every menu item "label" are translation keys.
const AppShell = ({ sectionLabel, menuItems }) => {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate('/login');
  };

  const initial = (user?.fullName || user?.username || '?').charAt(0).toUpperCase();

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
      isActive
        ? 'bg-card font-semibold text-ink shadow-[inset_3px_0_0_rgb(var(--mars))]'
        : 'font-medium text-ink-soft hover:bg-card/70 hover:text-ink'
    }`;

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-b border-line bg-sunken md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-5 pb-3 pt-5 md:pb-0 md:pt-6">
          <Logo />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={handleLogout}
              aria-label={t('common.logout')}
              className="rounded-lg p-2 text-ink-soft hover:bg-card hover:text-brick md:hidden"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <p className="hidden px-5 pb-2 pt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint md:block">
          {t(sectionLabel)}
        </p>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:pb-0">
          {menuItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end ?? true} className={linkClass}>
              <item.icon size={18} strokeWidth={1.8} className="shrink-0" />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center justify-between gap-2 px-4 pb-3 md:flex">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>

        <div className="hidden items-center gap-3 border-t border-line px-4 py-4 md:flex">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mars-tint font-display text-base font-semibold text-mars-deep">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{user?.fullName || user?.username}</div>
            <div className="text-xs text-ink-faint">{t(`roles.${user?.role}`)}</div>
          </div>
          <button
            onClick={handleLogout}
            title={t('common.logout')}
            aria-label={t('common.logout')}
            className="rounded-lg p-2 text-ink-soft hover:bg-card hover:text-brick"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 md:overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
          <div className="mb-4 flex items-center justify-end gap-4 md:hidden">
            <ThemeSwitch />
            <LanguageSwitch />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
