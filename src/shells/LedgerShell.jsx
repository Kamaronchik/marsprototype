import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import Eyebrow from '../components/Eyebrow';
import { useFetch } from '../lib/useFetch';
import { formatMoney } from '../lib/money';
import { ShellTools, UserChip, LogoutButton } from './parts';

const Figure = ({ label, value, tone = 'text-ink' }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">{label}</div>
    <div className={`font-display text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
  </div>
);

// FINANCE: LOGISTICS BAY. A wide labelled sidebar like the tabs of a ledger book, and across the top
// a ticker with the three numbers that matter this month: paid, salaries and what is left.
const LedgerShell = ({ menuItems }) => {
  const { t, i18n } = useTranslation();
  const { data } = useFetch('/api/finance/overview');
  const money = (amount) => formatMoney(amount, i18n.language, t);

  const tab = ({ isActive }) =>
    `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
      isActive ? 'bg-mars text-on-accent' : 'text-ink-soft hover:bg-card hover:text-ink'
    }`;

  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-b border-line bg-sunken md:w-64 md:border-b-0 md:border-r">
        <div className="px-5 pb-2 pt-5">
          <Link to="/financier"><Logo /></Link>
          <div className="mt-3"><Eyebrow>{t('eyebrow.finance')}</Eyebrow></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:overflow-y-auto" aria-label={t('home.navigation')}>
          {menuItems.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.end ?? true} className={tab}>
              <item.icon size={17} strokeWidth={1.8} className="shrink-0" />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center justify-between gap-2 border-t border-line px-4 py-3 md:flex">
          <UserChip />
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line bg-card px-6 py-3">
          {data ? (
            <>
              <Figure label={t('finance.revenue')} value={money(data.revenue)} tone="text-moss" />
              <Figure label={t('finance.salaries')} value={money(data.salaries)} tone="text-sky" />
              <Figure label={t('finance.net')} value={money(data.revenue - data.salaries)} tone={data.revenue - data.salaries < 0 ? 'text-brick' : 'text-ink'} />
              <Figure label={t('finance.debtors')} value={data.debtors} tone={data.debtors > 0 ? 'text-brick' : 'text-ink'} />
            </>
          ) : <span className="h-9" />}
          <div className="ml-auto flex items-center gap-4">
            <ShellTools />
            <span className="md:hidden"><LogoutButton /></span>
          </div>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>
      </div>
    </div>
  );
};

export default LedgerShell;
