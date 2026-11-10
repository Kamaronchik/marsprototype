import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Coins, Swords, Users } from 'lucide-react';
import Horizon from '../../components/Horizon';
import RankBadge from '../../components/RankBadge';
import MissionLog from '../../components/MissionLog';
import { SkeletonCard } from '../../components/Skeleton';
import { greetingKey, firstNameOf } from '../../lib/greeting';
import { launchWhen } from '../../lib/launch';
import { weekdaysText } from '../../lib/format';
import { useStudentHome } from './homeContext';

// Progress drawn as dunes: a wavy ground that fills from the left up to the percentage.
const DuneBar = ({ percent }) => {
  const wave = 'M0 12 C8 4 16 11 26 6 S46 2 58 7 S82 11 100 4 V14 H0Z';
  return (
    <div className="relative h-4 w-full" role="img" aria-label={`${percent ?? 0}%`}>
      <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-line"><path d={wave} fill="currentColor" /></svg>
      <svg
        viewBox="0 0 100 14"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-mars"
        style={{ clipPath: `inset(0 ${100 - (percent ?? 0)}% 0 0)` }}
      ><path d={wave} fill="currentColor" /></svg>
    </div>
  );
};

const Module = ({ icon: Icon, title, children, className = '' }) => (
  <section className={`rounded-3xl border border-line bg-card p-5 shadow-sm ${className}`}>
    <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
      <Icon size={15} className="text-mars" /> {title}
    </h2>
    <div className="mt-3">{children}</div>
  </section>
);

// The base home, before the numbers arrive: the landscape banner shows at once (it needs no data),
// the modules below are placeholders shaped like the six cards they will become.
const BaseHomeSkeleton = () => (
  <>
    <section className="relative mb-6 overflow-hidden rounded-[2rem] shadow-lg">
      <Horizon className="h-[14rem] w-full sm:h-[16rem]" />
    </section>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} lines={2} />)}
    </div>
  </>
);

// STUDENT DESIGN 2, home: Mars Base. A landscape banner with a greeting, then soft "habitat
// modules": launch, readiness as dunes, coins, battles, the crew and the log.
const BaseHome = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { data } = useStudentHome();

  if (!data) return <BaseHomeSkeleton />;
  const { nextLaunch: launch, rank, readiness, battles, coins, crews } = data;

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-[2rem] shadow-lg">
        <Horizon className="absolute inset-0 h-full w-full" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 px-7 pb-24 pt-10 text-[#fff4e8] sm:px-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ffd9a8]">{t('eyebrow.student')}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-tight drop-shadow sm:text-5xl">{t(greetingKey())}, {firstNameOf(user)}</h1>
            <p className="mt-2 text-sm text-[#ffe6cc]">{t(`ranks.${rank.key}`)} · {t('home.xpValue', { xp: rank.xp })}</p>
          </div>
          <div className="rounded-2xl bg-black/25 px-4 py-3">
            <RankBadge rank={rank} size={64} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Module icon={CalendarClock} title={t('home.nextLaunch')}>
          {launch ? (
            <>
              <p className="font-display text-3xl font-semibold text-mars">{launchWhen(launch, t, i18n.language)}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{launch.groupName}</p>
              <p className="text-sm text-ink-soft">{launch.startTime}–{launch.endTime} · {t('home.room', { room: launch.room })}</p>
            </>
          ) : (
            <>
              <p className="font-display text-xl font-semibold text-ink">{t('home.noLaunch')}</p>
              <p className="mt-1 text-sm text-ink-soft">{t('home.noLaunchHint')}</p>
            </>
          )}
        </Module>

        <Module icon={Users} title={t('home.readiness')}>
          <p className="font-display text-4xl font-semibold text-ink">{readiness.percent === null ? '—' : `${readiness.percent}%`}</p>
          <div className="mt-3"><DuneBar percent={readiness.percent} /></div>
          <p className="mt-2 text-xs text-ink-faint">{t('home.readinessLine', { came: readiness.present, missed: readiness.absent })}</p>
        </Module>

        <Module icon={Coins} title={t('home.coins')}>
          <p className="font-display text-4xl font-semibold text-ink">{coins}</p>
          <Link to="/student/shop" className="mt-3 inline-flex text-sm font-semibold text-mars hover:text-mars-deep">{t('home.toShop')} →</Link>
        </Module>

        <Module icon={Swords} title={t('home.wins')}>
          <p className="font-display text-4xl font-semibold text-ink">{battles.wins} <span className="text-lg font-medium text-ink-faint">/ {battles.played}</span></p>
          <Link to="/student/battle" className="mt-3 inline-flex text-sm font-semibold text-mars hover:text-mars-deep">{t('home.simulator')} →</Link>
        </Module>

        <Module icon={Users} title={t('home.crew')} className="md:col-span-1">
          {crews.length === 0 && <p className="text-sm text-ink-soft">{t('home.noLaunchHint')}</p>}
          <ul className="space-y-3">
            {crews.map((crew) => (
              <li key={crew.id}>
                <p className="text-sm font-semibold text-ink">{crew.name} <span className="font-normal text-ink-soft">· {crew.room}</span></p>
                <p className="text-xs text-ink-faint">{weekdaysText(crew.weekdays, i18n.language)} · {crew.startTime}{crew.teacherName ? ` · ${crew.teacherName}` : ''}</p>
              </li>
            ))}
          </ul>
        </Module>

        <section className="overflow-hidden rounded-3xl border border-line bg-card shadow-sm md:col-span-2 xl:col-span-1">
          <h2 className="border-b border-line px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{t('home.log')}</h2>
          <MissionLog entries={data.log} />
        </section>
      </div>
    </>
  );
};

export default BaseHome;
