import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Swords, Trophy, Coins } from 'lucide-react';
import Eyebrow from '../../components/Eyebrow';
import Gauge from '../../components/Gauge';
import MissionLog from '../../components/MissionLog';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { greetingKey, firstNameOf } from '../../lib/greeting';
import { launchWhen, launchProgress } from '../../lib/launch';
import { weekdaysText } from '../../lib/format';
import { subjectName } from '../../lib/subject';
import { useStudentHome } from './homeContext';

// The cockpit home, before the numbers arrive: the same two cards, filled with placeholders shaped
// like the gauges and text they will hold.
const CockpitHomeSkeleton = () => (
  <>
    <header className="mb-8"><SkeletonText width="10rem" height="0.7rem" className="mb-3" /><SkeletonText width="16rem" height="2.2rem" /></header>
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <section className="flex flex-col items-center gap-6 rounded-3xl border border-line bg-card p-6 sm:flex-row sm:p-8">
        <Skeleton width={176} height={176} className="!rounded-full shrink-0" />
        <div className="w-full space-y-2.5 text-center sm:text-left"><SkeletonText width="60%" height="1.5rem" /><SkeletonText width="80%" /></div>
      </section>
      <section className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card px-2 py-5">
            <Skeleton width={78} height={78} className="!rounded-full" />
            <SkeletonText width="70%" height="0.6rem" />
          </div>
        ))}
      </section>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <section className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="border-b border-line px-5 py-3.5"><SkeletonText width="8rem" /></div>
        <div className="space-y-3 p-5">{Array.from({ length: 3 }, (_, i) => <SkeletonText key={i} width={`${70 - i * 10}%`} />)}</div>
      </section>
      <Skeleton height="100%" className="min-h-[10rem] !rounded-3xl" />
    </div>
  </>
);

// STUDENT DESIGN 1, home: the cockpit. A big countdown ring for the next launch, three gauges,
// the mission log and one big way into the simulator.
const CockpitHome = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { data } = useStudentHome();

  if (!data) return <CockpitHomeSkeleton />;
  const { nextLaunch: launch, rank, readiness, battles, coins, crews } = data;
  const toNext = rank.xpForNext ? Math.round((rank.xpIntoRank / rank.xpForNext) * 100) : 100;

  return (
    <>
      <header className="mb-8">
        <Eyebrow>{t('eyebrow.student')}</Eyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{t(greetingKey())}, {firstNameOf(user)}</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="flex flex-col items-center gap-6 rounded-3xl border border-line bg-card p-6 sm:flex-row sm:p-8">
          <Gauge percent={launchProgress(launch)} size={176} stroke={12}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">{t('home.nextLaunch')}</span>
            {launch?.live && <span className="live-dot mt-1 h-2.5 w-2.5 rounded-full bg-mars" />}
            <span className="mt-1 max-w-[8.5rem] px-1 font-display text-xl font-semibold leading-tight text-ink">
              {launch ? launchWhen(launch, t, i18n.language) : '—'}
            </span>
          </Gauge>
          <div className="min-w-0 text-center sm:text-left">
            {launch ? (
              <>
                <h2 className="font-display text-2xl font-semibold text-ink">{launch.groupName}</h2>
                <p className="mt-1.5 text-sm text-ink-soft">{launch.startTime}–{launch.endTime} · {t('home.room', { room: launch.room })}</p>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold text-ink">{t('home.noLaunch')}</h2>
                <p className="mt-1.5 text-sm text-ink-soft">{t('home.noLaunchHint')}</p>
              </>
            )}
            {crews[0] && <p className="mt-3 text-xs text-ink-faint">{crews[0].subject ? `${subjectName(crews[0].subject, i18n.language)} · ` : ''}{crews[0].teacherName} · {weekdaysText(crews[0].weekdays, i18n.language)}</p>}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card px-2 py-5 text-center">
            <Gauge percent={readiness.percent} size={78} stroke={7} tone="text-moss">
              <span className="font-display text-base font-semibold text-ink">{readiness.percent === null ? '—' : `${readiness.percent}%`}</span>
            </Gauge>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('home.readiness')}</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card px-2 py-5 text-center">
            <Gauge percent={toNext} size={78} stroke={7} tone="text-sky">
              <span className="font-display text-base font-semibold text-ink">{rank.xp}</span>
            </Gauge>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">XP</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-card px-2 py-5 text-center">
            <span className="flex h-[78px] w-[78px] flex-col items-center justify-center">
              <Trophy size={20} className="text-ochre" />
              <span className="mt-1 font-display text-2xl font-semibold text-ink">{battles.wins}</span>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t('home.wins')}</span>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-3xl border border-line bg-card">
          <h2 className="border-b border-line px-5 py-3.5 font-display text-lg font-semibold text-ink">{t('home.log')}</h2>
          <MissionLog entries={data.log} />
        </section>

        <Link
          to="/student/battle"
          className="group flex flex-col justify-between gap-6 rounded-3xl border border-mars/40 bg-mars-tint p-6 shadow-[0_0_44px_-14px_rgb(var(--mars)/0.7)] hover:border-mars"
        >
          <div>
            <Swords size={26} className="text-mars" />
            <h2 className="mt-3 font-display text-2xl font-semibold text-ink">{t('home.simulator')}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">{t('home.simulatorHint')}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><Coins size={16} className="text-ochre" /> {coins}</span>
            <ArrowRight size={20} className="text-mars transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </div>
    </>
  );
};

export default CockpitHome;
