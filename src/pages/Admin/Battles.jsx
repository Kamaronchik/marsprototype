import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import CoinAmount from '../../components/CoinAmount';
import { useFetch } from '../../lib/useFetch';
import { formatDateTime } from '../../lib/format';

const LEVELS = ['intern', 'junior', 'middle', 'senior'];

const Stat = ({ label, value }) => (
  <div className="px-5 py-4">
    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
    <dd className="mt-1 font-display text-3xl font-semibold text-ink">{value}</dd>
  </div>
);

// Admin: how students use the Battle Arena, and how many questions each course and level has.
const Battles = () => {
  const { t, i18n } = useTranslation();
  const { data } = useFetch('/api/battles/stats');

  if (!data) return <PageHeader title={t('battleAdmin.title')}>{t('battleAdmin.subtitle')}</PageHeader>;

  const winner = (b) => {
    if (b.winnerSide === 'draw') return t('battleAdmin.draw');
    if (b.winnerSide === 'bot') return t('battleAdmin.bot');
    return b.winnerSide === 'creator' ? b.creatorName : b.opponentName;
  };

  return (
    <>
      <PageHeader title={t('battleAdmin.title')}>{t('battleAdmin.subtitle')}</PageHeader>

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
        <Stat label={t('battleAdmin.total')} value={data.totals.battles} />
        <Stat label={t('battleAdmin.finished')} value={data.totals.finished} />
        <Stat label={t('battleAdmin.ai')} value={data.totals.ai} />
        <Stat label={t('battleAdmin.pvp')} value={data.totals.pvp} />
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('battleAdmin.byCourse')}</h2>
          <div className="rounded-xl border border-line bg-card">
            <ul className="divide-y divide-line">
              {data.byCourse.map((row) => (
                <li key={row.course} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-semibold text-ink">{t(`battle.courses.${row.course}`)}</span>
                  <span className="tabular-nums text-ink-soft">{row.battles}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('battleAdmin.bank')}</h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  <th className="px-4 py-2.5">{t('battle.course')}</th>
                  {LEVELS.map((level) => <th key={level} className="px-4 py-2.5">{t(`battle.levels.${level}`)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.bank.map((row) => (
                  <tr key={row.course}>
                    <td className="px-4 py-2.5 font-semibold text-ink">{t(`battle.courses.${row.course}`)}</td>
                    {row.levels.map((l) => <td key={l.level} className="px-4 py-2.5 tabular-nums text-ink-soft">{l.questions}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">{t('battleAdmin.recent')}</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('common.date')}</th>
              <th className="px-5 py-3">{t('battle.course')}</th>
              <th className="px-5 py-3">{t('battleAdmin.players')}</th>
              <th className="px-5 py-3">{t('battleAdmin.score')}</th>
              <th className="px-5 py-3">{t('battleAdmin.winner')}</th>
              <th className="px-5 py-3">{t('battleAdmin.coins')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.recent.map((b) => (
              <tr key={b.id} className="hover:bg-sunken/40">
                <td className="px-5 py-3 text-sm text-ink-soft">{formatDateTime(b.finishedAt, i18n.language)}</td>
                <td className="px-5 py-3 text-sm text-ink">{t(`battle.courses.${b.course}`)} · {t(`battle.levels.${b.level}`)}</td>
                <td className="px-5 py-3 text-sm text-ink">{b.creatorName} · {b.opponentName ?? t('battleAdmin.bot')}</td>
                <td className="px-5 py-3 text-sm font-semibold tabular-nums text-ink">{b.score}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{winner(b)}</td>
                <td className="px-5 py-3 text-sm">{b.reward > 0 ? <CoinAmount amount={b.reward} className="text-ink" /> : '—'}</td>
              </tr>
            ))}
            {data.recent.length === 0 && (
              <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-ink-soft">{t('battleAdmin.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Battles;
