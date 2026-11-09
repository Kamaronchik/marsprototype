import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FolderOpen, X } from 'lucide-react';
import { useStudentHome } from '../features/student/homeContext';
import { ShellTools, UserChip, LogoutButton } from './parts';

// STUDENT DESIGN 3: CONSOLE. A code editor: a file explorer on the left, a tab with a path on top,
// the page in the editor area, and a status bar at the bottom with the crew's numbers.
const ExplorerShell = ({ menuItems }) => {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const { data } = useStudentHome() ?? {};

  const current = [...menuItems].reverse().find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)) ?? menuItems[0];

  const fileLink = ({ isActive }) =>
    `flex items-center gap-2.5 border-l-2 px-4 py-1.5 font-mono text-[13px] whitespace-nowrap ${
      isActive ? 'border-mars bg-mars-tint/60 text-ink' : 'border-transparent text-ink-soft hover:bg-card hover:text-ink'
    }`;

  return (
    <div className="flex min-h-screen flex-col md:h-screen">
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-sunken md:flex">
          <p className="px-4 pb-2 pt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">{t('console.explorer')}</p>
          <div className="flex items-center gap-1.5 px-3 pb-1.5 font-mono text-xs font-bold text-ink">
            <ChevronDown size={14} /> <FolderOpen size={14} className="text-mars" /> mars-space
          </div>
          <nav className="flex flex-1 flex-col overflow-y-auto">
            {menuItems.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.end ?? true} className={fileLink}>
                <item.icon size={15} strokeWidth={1.8} className="shrink-0" />
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-line px-4 py-3"><UserChip /></div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-stretch justify-between border-b border-line bg-sunken">
            <div className="flex min-w-0 items-center gap-2 border-r border-t-2 border-r-line border-t-mars bg-paper px-4 py-2 font-mono text-[13px] text-ink">
              <current.icon size={14} className="shrink-0 text-mars" />
              <span className="truncate">~/mars-space/{t(current.label).toLowerCase().replace(/\s+/g, '-')}</span>
              <X size={13} className="shrink-0 text-ink-faint" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-3 px-4">
              <ShellTools withDesign />
              <LogoutButton />
            </div>
          </div>

          {/* On a phone the explorer is a row of tabs */}
          <nav className="flex gap-1 overflow-x-auto border-b border-line bg-sunken px-2 py-1.5 md:hidden" aria-label={t('home.navigation')}>
            {menuItems.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.end ?? true} className={({ isActive }) => `whitespace-nowrap rounded px-2.5 py-1 font-mono text-xs ${isActive ? 'bg-mars text-on-accent' : 'text-ink-soft'}`}>
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-10">
            <div className="mx-auto max-w-6xl"><Outlet /></div>
          </main>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-mars px-4 py-1 font-mono text-[11px] font-semibold text-on-accent">
        <span className="flex items-center gap-1.5"><span className="live-dot h-1.5 w-1.5 rounded-full bg-on-accent" /> mars-space</span>
        {data && (
          <>
            <span>{t(`ranks.${data.rank.key}`)}</span>
            <span>{t('home.xpValue', { xp: data.rank.xp })}</span>
            <span>{data.coins} {t('shop.coins')}</span>
          </>
        )}
        <span className="ml-auto uppercase">{(i18n.resolvedLanguage || 'ru').slice(0, 2)}</span>
      </footer>
    </div>
  );
};

export default ExplorerShell;
