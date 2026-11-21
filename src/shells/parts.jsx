import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageSwitch from '../components/LanguageSwitch';
import ThemeToggle from '../components/ThemeToggle';
import { useLogout } from '../lib/useLogout';

// Pieces that every shell (page frame) uses in its own place.

// Bell, language and the dark mode button.
export const ShellTools = ({ bellAlign = 'right' }) => (
  <div className="flex items-center gap-3">
    <NotificationBell align={bellAlign} />
    <LanguageSwitch />
    <ThemeToggle />
  </div>
);

// Round initial, name and role of the signed-in person.
export const UserChip = ({ compact = false }) => {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const initial = (user?.fullName || user?.username || '?').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mars-tint font-display text-sm font-semibold text-mars">
        {initial}
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-ink">{user?.fullName || user?.username}</span>
          <span className="block text-xs text-ink-faint">{t(`roles.${user?.role}`)}</span>
        </span>
      )}
    </div>
  );
};

export const LogoutButton = ({ className = '' }) => {
  const { t } = useTranslation();
  const logout = useLogout();

  return (
    <button
      onClick={logout}
      title={t('common.logout')}
      aria-label={t('common.logout')}
      className={`rounded-lg p-2 text-ink-soft hover:bg-card hover:text-brick ${className}`}
    >
      <LogOut size={17} />
    </button>
  );
};
