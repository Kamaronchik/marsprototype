import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import Eyebrow from '../components/Eyebrow';
import CommandSearch from '../components/CommandSearch';
import StationClock from '../components/StationClock';
import { ShellTools, UserChip, LogoutButton } from './parts';

// ADMIN: MISSION CONTROL. A command bar across the top (search, the school's clock, tools) and a
// rail on the left whose links are grouped into Main, Crew, Operations, Money and System.
const ControlShell = ({ sections }) => {
  const { t } = useTranslation();
  const everything = sections.flatMap((section) => section.items);

  const railLink = ({ isActive }) =>
    `flex items-center gap-2.5 border-l-2 px-4 py-2 text-[13px] font-medium whitespace-nowrap ${
      isActive ? 'border-mars bg-mars-tint/70 text-ink' : 'border-transparent text-ink-soft hover:bg-card/60 hover:text-ink'
    }`;

  return (
    <div className="flex min-h-screen flex-col md:h-screen">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-sunken/85 px-4 py-2.5 backdrop-blur">
        <Link to="/admin" aria-label="Mars Space" className="flex items-center gap-3">
          <Logo compact />
          <span className="hidden sm:block"><Eyebrow>{t('eyebrow.admin')}</Eyebrow></span>
        </Link>
        <div className="order-last w-full md:order-none md:mx-auto md:w-auto md:flex-1 md:max-w-xl"><CommandSearch /></div>
        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <StationClock />
          <ShellTools />
          <UserChip compact />
          <LogoutButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-line bg-sunken/60 py-4 md:block">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-faint">{t(section.label)}</p>
              {section.items.map((item) => (
                <NavLink key={item.path} to={item.path} end={item.end ?? true} className={railLink}>
                  <item.icon size={16} strokeWidth={1.8} className="shrink-0" />
                  {t(item.label)}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* On a phone the rail is a row of links */}
          <nav className="flex gap-1 overflow-x-auto border-b border-line bg-sunken/60 px-2 py-1.5 md:hidden" aria-label={t('home.navigation')}>
            {everything.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.end ?? true} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${isActive ? 'bg-mars text-on-accent' : 'text-ink-soft'}`}>
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-7 md:px-9">
            <div className="mx-auto max-w-6xl"><Outlet /></div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ControlShell;
