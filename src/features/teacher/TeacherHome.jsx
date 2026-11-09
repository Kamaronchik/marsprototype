import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Coins, Users } from 'lucide-react';
import Eyebrow from '../../components/Eyebrow';
import CoinAmount from '../../components/CoinAmount';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { greetingKey, firstNameOf } from '../../lib/greeting';
import { formatDate, tashkentNow, timeToMinutes } from '../../lib/format';

const REFRESH_MS = 30 * 1000;

// The state of one lesson against the school's clock.
const stateOf = (lesson, minutes) => {
  const start = timeToMinutes(lesson.startTime);
  const end = timeToMinutes(lesson.endTime);
  if (minutes < start) return { key: 'upcoming', minutesUntil: start - minutes };
  if (minutes < end) return { key: 'live' };
  return { key: 'done' };
};

const NODE = { upcoming: 'bg-line', live: 'bg-mars', done: 'bg-moss' };

// TEACHER home, the Commander's Station: today's lessons in order on a timeline, how many students
// are already marked in each, a warning for lessons that ended with students unmarked, the coin pool.
const TeacherHome = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const today = useFetch('/api/attendance/today');
  const pool = useFetch('/api/wallet/pool');
  const [minutes, setMinutes] = useState(() => tashkentNow().minutes);

  useEffect(() => {
    const timer = setInterval(() => setMinutes(tashkentNow().minutes), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // today.data stays the same object between renders until the list is reloaded, so keying the memo
  // on it (not on a freshly-built `?? []` array) actually skips the work most of the time.
  const lessons = useMemo(() => today.data?.lessons ?? [], [today.data]);
  const marked = (lesson) => lesson.students.filter((s) => s.status !== null).length;
  // Recomputed only when the lessons change or the clock crosses into a new state (not on every
  // render): which lessons are already over with someone still unmarked.
  const forgotten = useMemo(
    () => lessons.filter((lesson) => stateOf(lesson, minutes).key === 'done' && lesson.students.length - marked(lesson) > 0),
    [lessons, minutes],
  );

  return (
    <>
      <header className="mb-8">
        <Eyebrow>{t('eyebrow.teacher')}</Eyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{t(greetingKey())}, {firstNameOf(user)}</h1>
        {today.data && <p className="mt-1.5 text-sm text-ink-soft">{formatDate(today.data.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
      </header>

      {forgotten.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ochre/40 bg-ochre-tint px-5 py-3.5 text-sm text-ochre">
          <span className="font-semibold">{t('teacherHome.forgotten', { count: forgotten.length })}</span>
          <Link to="/teacher/attendance" className="font-semibold underline underline-offset-4">{t('teacherHome.markNow')}</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">{t('teacherHome.timeline')}</h2>

          {today.loading && (
            <div className="space-y-4">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="rounded-2xl border border-line bg-card p-5">
                  <SkeletonText width="40%" height="0.7rem" className="mb-2" />
                  <SkeletonText width="60%" height="1.3rem" className="mb-4" />
                  <SkeletonText width="100%" height="0.5rem" />
                </div>
              ))}
            </div>
          )}

          {lessons.length === 0 && !today.loading && (
            <div className="rounded-2xl border border-dashed border-ink-faint/40 bg-card px-6 py-12 text-center">
              <p className="font-display text-lg font-semibold text-ink">{t('attendance.noLessons')}</p>
              <p className="mt-1 text-sm text-ink-soft">{t('attendance.noLessonsHint')}</p>
            </div>
          )}

          <ol className="relative space-y-4 border-l-2 border-line pl-7">
            {lessons.map((lesson) => {
              const state = stateOf(lesson, minutes);
              const done = marked(lesson);
              const total = lesson.students.length;
              return (
                <li key={lesson.groupId} className="relative">
                  <span className={`absolute -left-[2.2rem] top-5 h-3.5 w-3.5 rounded-full border-2 border-paper ${NODE[state.key]} ${state.key === 'live' ? 'live-dot' : ''}`} />
                  <div className={`rounded-2xl border bg-card p-5 ${state.key === 'live' ? 'border-mars shadow-[0_0_0_3px_rgb(var(--mars)/0.12)]' : 'border-line'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-ink-faint">{lesson.startTime}–{lesson.endTime} · {t('home.room', { room: lesson.room })}</p>
                        <h3 className="mt-1 font-display text-xl font-semibold text-ink">{lesson.groupName}</h3>
                      </div>
                      <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        { upcoming: 'bg-sunken text-ink-soft', live: 'bg-mars-tint text-mars', done: 'bg-moss-tint text-moss' }[state.key]
                      }`}>
                        {state.key === 'upcoming' && t('home.inMinutes', { m: state.minutesUntil })}
                        {state.key === 'live' && t('home.live')}
                        {state.key === 'done' && t('teacherHome.finished')}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <div className="min-w-[10rem] flex-1">
                        <div className="mb-1.5 flex justify-between text-xs text-ink-soft">
                          <span>{t('teacherHome.marked', { done, total })}</span>
                          <span>{total ? Math.round((done / total) * 100) : 0}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-sunken">
                          <div className={`h-full rounded-full ${done === total && total > 0 ? 'bg-moss' : 'bg-mars'}`} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                      {state.key !== 'upcoming' && done < total && (
                        <Link to="/teacher/attendance" className="btn-primary !py-2 text-sm"><ClipboardCheck size={16} /> {t('teacherHome.markNow')}</Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint"><Coins size={15} className="text-mars" /> {t('teacherCoins.pool')}</h2>
            <p className="mt-3 text-3xl">
              {pool.data && <CoinAmount amount={pool.data.balance} className="font-display text-ink" />}
              {!pool.data && pool.loading && <SkeletonText width="4rem" height="1.6rem" />}
              {!pool.data && !pool.loading && '—'}
            </p>
            <Link to="/teacher/coins" className="mt-3 inline-flex text-sm font-semibold text-mars hover:text-mars-deep">{t('teacherHome.giveCoins')} →</Link>
          </section>
          <Link to="/teacher/groups" className="flex items-center justify-between rounded-2xl border border-line bg-card p-5 hover:border-mars">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Users size={16} className="text-mars" /> {t('nav.myGroups')}</span>
            <span className="text-mars">→</span>
          </Link>
        </aside>
      </div>
    </>
  );
};

export default TeacherHome;
