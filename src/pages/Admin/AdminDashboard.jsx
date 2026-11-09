import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import Eyebrow from '../../components/Eyebrow';
import { Skeleton, SkeletonText, SkeletonStat } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { greetingKey, firstNameOf } from '../../lib/greeting';
import { formatDate, tashkentNow, timeToMinutes } from '../../lib/format';
import { formatMoney } from '../../lib/money';

const LESSON_MINUTES = 90;

const roleDot = { Admin: 'bg-ink', Teacher: 'bg-sky', Financier: 'bg-moss', Student: 'bg-mars' };

// A tile of the status board. A tile that needs attention gets a pulsing signal light.
const Tile = ({ label, value, alert = false }) => (
  <div className="relative px-5 py-4">
    {alert && <span className="live-dot absolute right-4 top-4 h-2 w-2 rounded-full bg-brick" />}
    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
    <dd className={`mt-1.5 font-display text-3xl font-semibold tracking-tight ${alert ? 'text-brick' : 'text-ink'}`}>{value}</dd>
  </div>
);

// The status board, before the four requests answer: the same tiles, list and chart shapes in grey.
const DashboardSkeleton = () => (
  <>
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><SkeletonText width="8rem" height="0.7rem" className="mb-3" /><SkeletonText width="18rem" height="2rem" /></div>
    </header>
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-5 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
      {Array.from({ length: 5 }, (_, i) => <SkeletonStat key={i} />)}
    </dl>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Skeleton height="16rem" className="!rounded-xl" />
      <div className="space-y-6"><Skeleton height="8rem" className="!rounded-xl" /><Skeleton height="8rem" className="!rounded-xl" /></div>
    </div>
    <Skeleton height="12rem" className="mt-6 !rounded-xl" />
  </>
);

// ADMIN home, Mission Control: a status board with live numbers, today's launches in time order,
// what needs attention, the last six months of payments and the newest people.
const AdminDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);

  const people = useFetch('/api/users');
  const groups = useFetch('/api/groups');
  const finance = useFetch('/api/finance/overview');
  const unmarked = useFetch('/api/attendance/unmarked');

  // people.data stays the same object between renders until the request is reloaded, so keying the
  // memo on it (not on a freshly-built `?? []` array) actually skips the work most of the time.
  const users = useMemo(() => people.data?.users ?? [], [people.data]);
  const allGroups = useMemo(() => groups.data?.groups ?? [], [groups.data]);
  const history = useMemo(() => finance.data?.history ?? [], [finance.data]);
  const lessonsWithoutMarks = unmarked.data?.lessons.length ?? 0;
  const debtors = finance.data?.debtors ?? 0;

  // These all re-scan the people/groups lists; without useMemo every one would be redone on every
  // render, including the render after the teacher-attendance clock ticks elsewhere on the page.
  const { count, blocked, active, newest } = useMemo(() => {
    const byRole = (role) => users.filter((u) => u.role === role).length;
    return {
      count: byRole,
      blocked: users.filter((u) => u.status === 'blocked').length,
      active: allGroups.filter((g) => g.status === 'active'),
      newest: [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    };
  }, [users, allGroups]);

  const { weekday, minutes } = tashkentNow();
  const launches = useMemo(
    () => active.filter((g) => g.weekdays.includes(weekday)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [active, weekday],
  );
  const since = (g) => minutes - timeToMinutes(g.startTime);
  const over = (g) => since(g) >= LESSON_MINUTES;
  const started = (g) => since(g) >= 0;
  const live = (g) => started(g) && !over(g);

  const peak = useMemo(() => Math.max(1, ...history.map((h) => h.revenue)), [history]);

  const attention = [
    { show: lessonsWithoutMarks > 0, to: '/admin/attendance', text: t('dashboard.unmarked', { count: lessonsWithoutMarks }) },
    { show: debtors > 0, to: '/admin/debts', text: t('dashboard.debtorsHint', { count: debtors }) },
    { show: blocked > 0, to: '/admin/users', text: t('dashboard.blocked', { count: blocked }) },
  ].filter((item) => item.show);

  if (people.loading || groups.loading || finance.loading) return <DashboardSkeleton />;

  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{t('eyebrow.admin')}</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">{t(greetingKey())}, {firstNameOf(user)}</h1>
        </div>
        <p className="flex items-center gap-2 rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink-soft">
          <span className={`h-2 w-2 rounded-full ${attention.length ? 'live-dot bg-brick' : 'bg-moss'}`} />
          {attention.length ? t('board.attention', { count: attention.length }) : t('board.allClear')}
        </p>
      </header>

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-5 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
        <Tile label={t('dashboard.students')} value={count('Student')} />
        <Tile label={t('dashboard.teachers')} value={count('Teacher')} />
        <Tile label={t('dashboard.groups')} value={active.length} />
        <Tile label={t('dashboard.debtors')} value={debtors} alert={debtors > 0} />
        <Tile label={t('dashboard.paid')} value={finance.data ? formatMoney(finance.data.revenue, i18n.language, t) : '—'} />
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-line bg-card">
          <h2 className="border-b border-line px-5 py-3.5 font-display text-lg font-semibold text-ink">{t('board.today')}</h2>
          {launches.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-soft">{t('attendance.noLessons')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {launches.map((g) => (
                <li key={g.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="w-14 shrink-0 font-mono text-sm font-semibold text-ink">{g.startTime}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{g.name}</p>
                    <p className="truncate text-xs text-ink-faint">{g.teacherName} · {t('home.room', { room: g.room })} · {t('groups.studentsCount', { count: g.studentCount })}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
                    live(g) ? 'bg-mars-tint text-mars' : over(g) ? 'bg-moss-tint text-moss' : 'bg-sunken text-ink-soft'
                  }`}>
                    {live(g) && <span className="live-dot h-1.5 w-1.5 rounded-full bg-mars" />}
                    {live(g) ? t('home.live') : over(g) ? t('teacherHome.finished') : t('board.upcoming')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-line bg-card">
            <h2 className="border-b border-line px-5 py-3.5 font-display text-lg font-semibold text-ink">{t('dashboard.jump')}</h2>
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

          <div className="rounded-xl border border-line bg-card p-5">
            <h2 className="font-display text-lg font-semibold text-ink">{t('board.paidHistory')}</h2>
            <ul className="mt-4 grid grid-cols-6 items-end gap-2" style={{ height: '5.5rem' }}>
              {history.map((h) => (
                <li key={h.month} className="flex h-full flex-col justify-end" title={formatMoney(h.revenue, i18n.language, t)}>
                  <div className="w-full rounded-t bg-mars" style={{ height: `${Math.max(4, (h.revenue / peak) * 100)}%` }} />
                </li>
              ))}
            </ul>
            <ul className="mt-1.5 grid grid-cols-6 gap-2 text-center text-[10px] text-ink-faint">
              {history.map((h) => <li key={h.month}>{formatDate(`${h.month}-01`, i18n.language, { month: 'short' })}</li>)}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-card">
        <div className="flex items-baseline justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-ink">{t('dashboard.newest')}</h2>
          <Link to="/admin/users" className="text-sm font-medium text-mars hover:text-mars-deep">{t('dashboard.seeEveryone')}</Link>
        </div>
        {newest.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-ink-soft">{t('dashboard.noOne')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {newest.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${roleDot[u.role] || 'bg-ink-faint'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  <span className="font-semibold">{u.fullName}</span>
                  <span className="text-ink-soft"> {t('dashboard.joinedAs', { role: t(`roles.${u.role}`).toLowerCase() })}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-faint">{formatDate(u.createdAt, i18n.language, { day: 'numeric', month: 'short' })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

export default AdminDashboard;
