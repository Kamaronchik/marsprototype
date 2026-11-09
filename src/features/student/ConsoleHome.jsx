import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../lib/format';
import { launchWhen } from '../../lib/launch';
import { useStudentHome } from './homeContext';

const BAR_WIDTH = 20;

// A progress bar made of characters: 62% -> █████████████░░░░░░░ (rounded to whole cells).
const asciiBar = (percent) => {
  const filled = Math.round(((percent ?? 0) / 100) * BAR_WIDTH);
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
};

const Prompt = ({ children }) => (
  <p className="mt-6 first:mt-0"><span className="text-mars">$</span> <span className="text-ink">{children}</span></p>
);

const Row = ({ name, children }) => (
  <p className="flex flex-wrap gap-x-4"><span className="w-28 shrink-0 text-ink-faint">{name}</span><span className="min-w-0 text-ink">{children}</span></p>
);

// STUDENT DESIGN 3, home: a terminal. The numbers are printed as the output of commands.
const ConsoleHome = () => {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { data } = useStudentHome();

  if (!data) return null;
  const { nextLaunch: launch, rank, readiness, battles, coins } = data;
  const toNext = rank.xpForNext ? Math.round((rank.xpIntoRank / rank.xpForNext) * 100) : 100;

  return (
    <>
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mars">{t('eyebrow.student')}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{user?.fullName || user?.username}</h1>
      </header>

      <section className="rounded-lg border border-line bg-card font-mono text-[13px] leading-relaxed">
        <div className="flex items-center gap-1.5 border-b border-line bg-sunken px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brick" /><span className="h-2.5 w-2.5 rounded-full bg-ochre" /><span className="h-2.5 w-2.5 rounded-full bg-moss" />
          <span className="ml-3 text-xs text-ink-faint">mars-space — bash</span>
        </div>

        <div className="overflow-x-auto p-5">
          <Prompt>mars status</Prompt>
          <div className="mt-2 space-y-1">
            <Row name={t('console.rank')}>{t(`ranks.${rank.key}`)} <span className="text-ink-faint">{asciiBar(toNext)} {toNext}%</span></Row>
            <Row name="xp">{rank.xp}{rank.xpForNext && <span className="text-ink-faint"> / {rank.xpForNext + (rank.xp - rank.xpIntoRank)}</span>}</Row>
            <Row name={t('home.readiness')}>{readiness.percent === null ? '—' : `${readiness.percent}%`} <span className="text-ink-faint">{asciiBar(readiness.percent)}</span></Row>
            <Row name={t('home.coins')}>{coins}</Row>
            <Row name={t('home.wins')}>{battles.wins} <span className="text-ink-faint">/ {battles.played}</span></Row>
          </div>

          <Prompt>mars next-launch</Prompt>
          <div className="mt-2">
            {launch ? (
              <p className="text-ink"><span className="text-mars">&gt;</span> {launch.groupName} · {t('home.room', { room: launch.room })} · {launch.startTime}–{launch.endTime} · <span className="font-bold text-mars">{launchWhen(launch, t, i18n.language)}</span></p>
            ) : (
              <p className="text-ink-soft">{t('home.noLaunch')}. {t('home.noLaunchHint')}</p>
            )}
          </div>

          <Prompt>mars log --last 5</Prompt>
          <div className="mt-2 space-y-0.5">
            {data.log.length === 0 && <p className="text-ink-soft">{t('home.logEmpty')}</p>}
            {data.log.map((entry) => (
              <p key={`${entry.date}-${entry.groupName}`} className="text-ink">
                <span className="text-ink-faint">{formatDate(entry.date, i18n.language, { day: '2-digit', month: '2-digit' })}</span>{' '}
                <span className={entry.status === 'present' ? 'text-moss' : 'text-brick'}>{entry.status === 'present' ? '[ok]' : '[--]'}</span> {entry.groupName}
              </p>
            ))}
          </div>

          <Prompt>
            <Link to="/student/battle" className="text-mars underline-offset-4 hover:underline">mars simulator --start</Link>
            <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 bg-mars align-middle" />
          </Prompt>
        </div>
      </section>
    </>
  );
};

export default ConsoleHome;
