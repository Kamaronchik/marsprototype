import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Bot, Users } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import CoinAmount from '../../components/CoinAmount';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { usePolling } from '../../lib/usePolling';
import { SkeletonRow, SkeletonStat } from '../../components/Skeleton';
import { formatDateTime } from '../../lib/format';

const CHALLENGES_REFRESH_MS = 5000;

const choiceClass = (selected) => (selected
  ? 'border-mars bg-mars-tint text-mars-deep font-semibold'
  : 'border-line bg-card text-ink hover:border-ink-faint');

const OUTCOME_STYLE = {
  win: 'bg-moss-tint text-moss',
  loss: 'bg-brick-tint text-brick',
  draw: 'bg-sunken text-ink-soft',
};

// Student: choose a course and a level, then play the bot, open a challenge, or accept one.
const BattleArena = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const options = useFetch('/api/battles/options');
  const challenges = useFetch('/api/battles/challenges');
  const history = useFetch('/api/battles/history');

  const [tab, setTab] = useState('play');
  const [course, setCourse] = useState('js');
  const [level, setLevel] = useState('intern');
  const [busy, setBusy] = useState(false);

  // The list of open challenges refreshes by itself.
  const { reload } = challenges;
  usePolling(reload, CHALLENGES_REFRESH_MS);

  const config = options.data;
  // Re-split only when the challenge list itself changes (every 5s at most), not on every render
  // this component does in between, such as picking a course or level.
  const { mine, others } = useMemo(() => {
    const open = challenges.data?.challenges ?? [];
    return { mine: open.find((c) => c.mine), others: open.filter((c) => !c.mine) };
  }, [challenges.data]);

  const go = async (request, nextPath) => {
    setBusy(true);
    try {
      const result = await request();
      navigate(nextPath(result));
    } catch (error) {
      toast.error(errorText(t, error));
      reload();
    } finally {
      setBusy(false);
    }
  };

  const startAi = () => go(() => api('/api/battles/ai', { method: 'POST', body: { course, level } }), (r) => `/student/battle/${r.battleId}`);
  const createChallenge = () => go(() => api('/api/battles/challenges', { method: 'POST', body: { course, level } }), (r) => `/student/battle/${r.battleId}`);
  const accept = (challenge) => go(() => api(`/api/battles/challenges/${challenge.id}/accept`, { method: 'POST' }), (r) => `/student/battle/${r.battleId}`);

  const cancel = async () => {
    try {
      await api(`/api/battles/challenges/${mine.id}`, { method: 'DELETE' });
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const tabClass = (name) => `border-b-2 px-1 pb-3 text-sm font-semibold ${
    tab === name ? 'border-mars text-ink' : 'border-transparent text-ink-faint hover:text-ink'
  }`;

  const stats = history.data?.stats;
  const played = history.data?.battles ?? [];

  return (
    <>
      <PageHeader title={t('battle.title')}>{t('battle.subtitle')}</PageHeader>

      {config && (
        <p className={`mb-5 rounded-lg px-4 py-3 text-sm ${config.remainingToday === 0 ? 'bg-ochre-tint text-ochre' : 'bg-card text-ink-soft border border-line'}`}>
          {config.remainingToday === 0
            ? t('battle.dailyFull')
            : `${t('battle.reward', { reward: config.reward })} ${t('battle.dailyCoins', { earned: config.earnedToday, limit: config.dailyLimit })}`}
        </p>
      )}

      <div className="mb-6 flex gap-6 border-b border-line">
        <button onClick={() => setTab('play')} className={tabClass('play')}>{t('battle.play')}</button>
        <button onClick={() => setTab('history')} className={tabClass('history')}>{t('battle.history')}</button>
      </div>

      {tab === 'play' && (
        <>
          <div className="mb-6 grid gap-5 rounded-xl border border-line bg-card p-5 md:grid-cols-2">
            <fieldset>
              <legend className="field-label">{t('battle.course')}</legend>
              <div className="flex flex-wrap gap-2">
                {(config?.courses ?? []).map((c) => (
                  <button key={c} type="button" aria-pressed={course === c} onClick={() => setCourse(c)} className={`rounded-lg border px-4 py-2 text-sm ${choiceClass(course === c)}`}>
                    {t(`battle.courses.${c}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="field-label">{t('battle.level')}</legend>
              <div className="flex flex-wrap gap-2">
                {(config?.levels ?? []).map((l) => (
                  <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={`rounded-lg border px-4 py-2 text-sm ${choiceClass(level === l)}`}>
                    {t(`battle.levels.${l}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-tint text-sky"><Bot size={20} /></span>
                <h2 className="font-display text-xl font-semibold text-ink">{t('battle.vsBot')}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('battle.vsBotHint')}</p>
              <button onClick={startAi} disabled={busy || !config} className="btn-primary mt-5">{t('battle.start')}</button>
            </section>

            <section className="rounded-xl border border-line bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mars-tint text-mars"><Users size={20} /></span>
                <h2 className="font-display text-xl font-semibold text-ink">{t('battle.vsStudent')}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t('battle.vsStudentHint')}</p>
              {mine ? (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-ochre-tint px-4 py-3 text-sm text-ochre">
                  <span className="font-semibold">{t('battle.yourChallenge')}: {t(`battle.courses.${mine.course}`)} · {t(`battle.levels.${mine.level}`)}</span>
                  <span className="ml-auto flex gap-2">
                    <button onClick={() => navigate(`/student/battle/${mine.id}`)} className="btn-quiet !px-3 !py-1.5 text-xs">{t('battle.openIt')}</button>
                    <button onClick={cancel} className="btn-quiet !px-3 !py-1.5 text-xs">{t('battle.cancelChallenge')}</button>
                  </span>
                </div>
              ) : (
                <button onClick={createChallenge} disabled={busy || !config} className="btn-primary mt-5">{t('battle.createChallenge')}</button>
              )}
            </section>
          </div>

          <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">{t('battle.challenges')}</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            <ul className="divide-y divide-line">
              {challenges.loading && Array.from({ length: 2 }, (_, i) => <SkeletonRow key={i} />)}
              {!challenges.loading && others.map((c) => (
                <li key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{c.creatorName}</div>
                    <div className="text-xs text-ink-faint">
                      {t(`battle.courses.${c.course}`)} · {t(`battle.levels.${c.level}`)} · {formatDateTime(c.createdAt, i18n.language)}
                    </div>
                  </div>
                  <button onClick={() => accept(c)} disabled={busy} className="btn-primary !px-4 !py-2 text-sm">{t('battle.accept')}</button>
                </li>
              ))}
              {!challenges.loading && others.length === 0 && <li className="px-5 py-10 text-center text-sm text-ink-soft">{t('battle.noChallenges')}</li>}
            </ul>
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          {history.loading && (
            <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
              {Array.from({ length: 4 }, (_, i) => <SkeletonStat key={i} />)}
            </dl>
          )}
          {stats && (
            <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
              <div className="px-5 py-4"><dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('battle.wins')}</dt><dd className="mt-1 font-display text-3xl font-semibold text-moss">{stats.wins}</dd></div>
              <div className="px-5 py-4"><dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('battle.losses')}</dt><dd className="mt-1 font-display text-3xl font-semibold text-ink">{stats.losses}</dd></div>
              <div className="px-5 py-4"><dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('battle.draws')}</dt><dd className="mt-1 font-display text-3xl font-semibold text-ink">{stats.draws}</dd></div>
              <div className="px-5 py-4"><dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('battle.coinsTotal')}</dt><dd className="mt-1 text-3xl"><CoinAmount amount={stats.coins} className="font-display text-ink" /></dd></div>
            </dl>
          )}
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            <ul className="divide-y divide-line">
              {history.loading && Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}
              {!history.loading && played.map((b) => (
                <li key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className={`w-24 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold ${OUTCOME_STYLE[b.outcome]}`}>{t(`battle.${b.outcome}`)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {t(`battle.courses.${b.course}`)} · {t(`battle.levels.${b.level}`)}
                    </div>
                    <div className="truncate text-xs text-ink-faint">
                      {t('battle.vs', { name: b.opponentName ?? t('battle.bot', { level: t(`battle.levels.${b.level}`) }) })} · {formatDateTime(b.finishedAt, i18n.language)}
                    </div>
                  </div>
                  <span className="font-display text-lg font-semibold tabular-nums text-ink">{b.myScore}:{b.opponentScore}</span>
                  {b.reward > 0 && <CoinAmount amount={`+${b.reward}`} className="text-moss" />}
                </li>
              ))}
              {played.length === 0 && !history.loading && (
                <li className="px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold text-ink">{t('battle.noHistory')}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t('battle.noHistoryHint')}</p>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </>
  );
};

export default BattleArena;
