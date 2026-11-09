import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import RankBadge from '../components/RankBadge';
import CoinAmount from '../components/CoinAmount';
import { useStudentHome } from '../features/student/homeContext';
import { ShellTools, UserChip, LogoutButton } from './parts';

// STUDENT DESIGN 1: COCKPIT. No sidebar. A HUD bar on top (rank, coins, tools) and the navigation
// as a floating dock at the bottom, the way an app on a phone works.
const DockShell = ({ menuItems }) => {
  const { t } = useTranslation();
  const { data } = useStudentHome() ?? {};

  const dockLink = ({ isActive }) =>
    `flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium whitespace-nowrap ${
      isActive ? 'bg-mars text-on-accent shadow-[0_6px_20px_-6px_rgb(var(--mars)/0.8)]' : 'text-ink-soft hover:bg-sunken hover:text-ink'
    }`;

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/65 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <Logo />
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
            {data && (
              <>
                <RankBadge rank={data.rank} size={40} />
                <div className="hidden leading-tight sm:block">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{t(`ranks.${data.rank.key}`)}</div>
                  <div className="text-xs font-semibold text-ink-soft">{t('home.xpValue', { xp: data.rank.xp })}</div>
                </div>
                <CoinAmount amount={data.coins} className="text-ink" />
              </>
            )}
            <ShellTools withDesign />
            <UserChip compact />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>

      <nav aria-label={t('home.navigation')} className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-card/80 p-1.5 shadow-xl backdrop-blur-xl">
          {menuItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end ?? true} className={dockLink}>
              <item.icon size={20} strokeWidth={1.8} />
              {t(item.label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default DockShell;
