import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { useFetch } from '../../lib/useFetch';
import { formatDate } from '../../lib/format';
import { formatMoney } from '../../lib/money';

const greetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'dashboard.greetingNight';
  if (hour < 12) return 'dashboard.greetingMorning';
  if (hour < 18) return 'dashboard.greetingAfternoon';
  return 'dashboard.greetingEvening';
};

const roleDot = {
  Admin: 'bg-ink',
  Teacher: 'bg-sky',
  Financier: 'bg-moss',
  Student: 'bg-mars',
};

// Admin front page. Every number comes from the server.
const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);

  const people = useFetch('/api/users');
  const groups = useFetch('/api/groups');
  const finance = useFetch('/api/finance/overview');
  const unmarked = useFetch('/api/attendance/unmarked');

  const users = people.data?.users ?? [];
  const count = (role) => users.filter((u) => u.role === role).length;
  const blocked = users.filter((u) => u.status === 'blocked').length;
  const activeGroups = (groups.data?.groups ?? []).filter((g) => g.status === 'active').length;
  const debtors = finance.data?.debtors ?? 0;
  const lessonsWithoutMarks = unmarked.data?.lessons.length ?? 0;
  const firstName = (user?.fullName || user?.username || '').split(' ')[0];

  const today = formatDate(new Date().toISOString(), i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });

  const stats = [
    { label: t('dashboard.students'), value: count('Student') },
    { label: t('dashboard.teachers'), value: count('Teacher') },
    { label: t('dashboard.groups'), value: activeGroups },
    { label: t('dashboard.debtors'), value: debtors },
    { label: t('dashboard.paid'), value: finance.data ? formatMoney(finance.data.revenue, i18n.language, t) : '—' },
  ];

  const newest = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  const attention = [
    { show: lessonsWithoutMarks > 0, to: '/admin/attendance', text: t('dashboard.unmarked', { count: lessonsWithoutMarks }) },
    { show: debtors > 0, to: '/admin/debts', text: t('dashboard.debtorsHint', { count: debtors }) },
    { show: blocked > 0, to: '/admin/users', text: t('dashboard.blocked', { count: blocked }) },
  ].filter((item) => item.show);

  return (
    <>
      <PageHeader title={`${t(greetingKey())}, ${firstName}`}>{today}</PageHeader>

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-3 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-5">
            <dt className="text-sm text-ink-soft">{s.label}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold leading-tight tracking-tight text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">{t('dashboard.newest')}</h2>
            <Link to="/admin/users" className="text-sm font-medium text-mars hover:text-mars-deep">{t('dashboard.seeEveryone')}</Link>
          </div>

          <div className="rounded-xl border border-line bg-card">
            {newest.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-ink-soft">{t('dashboard.noOne')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {newest.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${roleDot[u.role] || 'bg-ink-faint'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      <span className="font-semibold">{u.fullName}</span>
                      <span className="text-ink-soft"> {t('dashboard.joinedAs', { role: t(`roles.${u.role}`).toLowerCase() })}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {formatDate(u.createdAt, i18n.language, { day: 'numeric', month: 'short' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('dashboard.jump')}</h2>
          <div className="rounded-xl border border-line bg-card">
            {attention.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-soft">{t('dashboard.allGood')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-sunken/60">
                      <span className="text-sm font-medium text-ink">{item.text}</span>
                      <ArrowUpRight size={17} className="shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default AdminDashboard;
