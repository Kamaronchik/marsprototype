import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import { ShellTools, UserChip, LogoutButton } from './parts';

// STUDENT DESIGN 2: MARS BASE. A slim rail of big icon buttons on the left, a thin bar of tools on
// top, and the page itself in a wide calm area. On a phone the rail becomes a tab bar at the bottom.
const RailShell = ({ menuItems }) => {
  const { t } = useTranslation();

  const railLink = ({ isActive }) =>
    `flex w-[4.5rem] flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[10px] font-semibold leading-tight text-center ${
      isActive ? 'bg-card text-mars shadow-sm' : 'text-ink-soft hover:bg-card/60 hover:text-ink'
    }`;

  const tabLink = ({ isActive }) =>
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-mars' : 'text-ink-soft'}`;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-24 shrink-0 flex-col items-center border-r border-line bg-sunken/80 py-5 md:flex">
        <Link to="/student" aria-label="Mars Space"><Logo compact /></Link>
        <nav className="mt-8 flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end ?? true} className={railLink}>
              <item.icon size={22} strokeWidth={1.7} />
              <span className="px-0.5">{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>
        <LogoutButton />
      </aside>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3 backdrop-blur md:px-8">
          <Link to="/student" className="md:hidden"><Logo /></Link>
          <div className="ml-auto flex items-center gap-5">
            <ShellTools withDesign />
            <span className="hidden sm:block"><UserChip /></span>
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-5 pb-12 md:px-8">
          <Outlet />
        </main>
      </div>

      <nav aria-label={t('home.navigation')} className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card/95 backdrop-blur md:hidden">
        {menuItems.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.end ?? true} className={tabLink}>
            <item.icon size={20} strokeWidth={1.8} />
            <span className="max-w-full truncate px-0.5">{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default RailShell;
