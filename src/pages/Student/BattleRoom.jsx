import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import CoinAmount from '../../components/CoinAmount';
import { api, errorText } from '../../lib/api';

const POLL_MS = 2000;
const FEEDBACK_MS = 1300;   // how long the right answer stays on screen before the next question
const QUESTION_SECONDS = 20;
const LETTERS = ['A', 'B', 'C', 'D'];

// One battle: waiting for an opponent, the questions with a 20 second timer, waiting for the
// other player, and the result. The page only shows what the server sends; it never knows
// the right answer before the player has answered.
const BattleRoom = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null); // { position, correct, correctPosition } after an answer
  const [clockOffset, setClockOffset] = useState(0); // server clock minus this computer's clock
  const [now, setNow] = useState(Date.now());

  // Every change of `version` asks the server again; the answer replaces the whole screen.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    api(`/api/battles/${id}`)
      .then((data) => {
        if (cancelled) return;
        if (data.question) setClockOffset(Date.parse(data.question.now) - Date.now());
        setView(data);
        setFeedback(null);
      })
      .catch((e) => { if (!cancelled) setError(e); });
    return () => { cancelled = true; };
  }, [id, version]);

  const question = view?.question;
  const waitingForOther = view?.waiting;
  const waitingForOpponent = view?.battle.status === 'open';

  // While waiting, ask the server every 2 seconds.
  useEffect(() => {
    if (!waitingForOther && !waitingForOpponent) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [waitingForOther, waitingForOpponent, load]);

  // The countdown.
  useEffect(() => {
    if (!question) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [question]);

  // When the 20 seconds end, the server closes the question and sends the next one.
  useEffect(() => {
    if (!question || feedback) return undefined;
    const wait = Date.parse(question.endsAt) - (Date.now() + clockOffset) + 400;
    const timer = setTimeout(load, Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [question, feedback, clockOffset, load]);

  const answer = async (position) => {
    if (feedback) return;
    try {
      const reply = await api(`/api/battles/${id}/answer`, { method: 'POST', body: { round: question.round, position } });
      setFeedback({ position, correct: reply.correct, correctPosition: reply.correctPosition });
      setTimeout(load, FEEDBACK_MS);
    } catch (e) {
      toast.error(errorText(t, e));
      load();
    }
  };

  const cancelChallenge = async () => {
    try {
      await api(`/api/battles/challenges/${id}`, { method: 'DELETE' });
    } catch {
      // Already taken or cancelled: just leave.
    }
    navigate('/student/battle');
  };

  const opponentLabel = (battle) => (battle.mode === 'ai'
    ? t('battle.bot', { level: t(`battle.levels.${battle.level}`) })
    : battle.opponentName);

  if (error) {
    return (
      <>
        <PageHeader title={t('battle.title')}>{errorText(t, error)}</PageHeader>
        <Link to="/student/battle" className="btn-primary">{t('battle.back')}</Link>
      </>
    );
  }
  if (!view) {
    return <div className="flex justify-center py-20 text-ink-faint"><Loader2 className="animate-spin" /></div>;
  }

  const { battle } = view;
  const title = `${t(`battle.courses.${battle.course}`)} · ${t(`battle.levels.${battle.level}`)}`;

  if (waitingForOpponent) {
    return (
      <>
        <PageHeader title={title}>{t('battle.waitingOpponentHint')}</PageHeader>
        <div className="rounded-xl border border-line bg-card px-6 py-14 text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-mars" size={30} />
          <p className="font-display text-xl font-semibold text-ink">{t('battle.waitingOpponent')}</p>
          <button onClick={cancelChallenge} className="btn-quiet mt-6">{t('battle.cancelChallenge')}</button>
        </div>
      </>
    );
  }

  if (battle.status === 'cancelled' || battle.status === 'expired') {
    return (
      <>
        <PageHeader title={title}>{t('errors.CHALLENGE_TAKEN')}</PageHeader>
        <Link to="/student/battle" className="btn-primary">{t('battle.back')}</Link>
      </>
    );
  }

  if (question) {
    const secondsLeft = Math.max(0, Math.ceil((Date.parse(question.endsAt) - (now + clockOffset)) / 1000));
    const optionClass = (position) => {
      if (!feedback) return 'border-line bg-card hover:border-mars hover:bg-mars-tint/40';
      if (position === feedback.correctPosition) return 'border-moss bg-moss-tint text-moss';
      if (position === feedback.position) return 'border-brick bg-brick-tint text-brick';
      return 'border-line bg-card opacity-60';
    };

    return (
      <>
        <PageHeader title={title}>{opponentLabel(battle) ? t('battle.vs', { name: opponentLabel(battle) }) : ''}</PageHeader>

        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-ink-soft">{t('battle.question', { n: question.round + 1, total: question.total })}</span>
            <span className={`font-display text-xl font-semibold tabular-nums ${secondsLeft <= 5 ? 'text-brick' : 'text-ink'}`}>
              {t('battle.seconds', { seconds: secondsLeft })}
            </span>
          </div>
          <div className="mb-6 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={QUESTION_SECONDS} aria-valuenow={secondsLeft}>
            <div className={`h-full rounded-full ${secondsLeft <= 5 ? 'bg-brick' : 'bg-mars'}`} style={{ width: `${(secondsLeft / QUESTION_SECONDS) * 100}%` }} />
          </div>

          <h2 className="mb-5 font-display text-2xl font-semibold leading-snug text-ink">{question.text}</h2>

          <div className="space-y-3">
            {question.options.map((option) => (
              <button
                key={option.position}
                onClick={() => answer(option.position)}
                disabled={!!feedback}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-[15px] leading-snug ${optionClass(option.position)}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sunken text-xs font-bold text-ink-soft">{LETTERS[option.position]}</span>
                <span className="break-words font-mono text-[14px]">{option.text}</span>
              </button>
            ))}
          </div>

          {feedback && (
            <p className={`mt-4 text-center text-sm font-semibold ${feedback.correct ? 'text-moss' : 'text-brick'}`}>
              {feedback.correct ? t('battle.correct') : t('battle.wrong')}
            </p>
          )}
        </div>
      </>
    );
  }

  if (waitingForOther) {
    return (
      <>
        <PageHeader title={title} />
        <div className="rounded-xl border border-line bg-card px-6 py-14 text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-mars" size={30} />
          <p className="font-display text-xl font-semibold text-ink">{t('battle.waitingOther')}</p>
        </div>
      </>
    );
  }

  const { result } = view;
  if (!result) return null;

  const tone = { win: 'text-moss', loss: 'text-brick', draw: 'text-ink' }[result.outcome];
  return (
    <>
      <PageHeader title={title}>{opponentLabel(battle) ? t('battle.vs', { name: opponentLabel(battle) }) : ''}</PageHeader>

      <div className="mx-auto max-w-2xl">
        <section className="rounded-xl border border-line bg-card px-6 py-8 text-center">
          <p className={`font-display text-4xl font-semibold ${tone}`}>{t(`battle.${result.outcome}`)}</p>
          <p className="mt-3 text-sm text-ink-soft">
            {t('battle.youScored', { mine: result.myScore, total: result.total })} · {t('battle.theyScored', { name: opponentLabel(battle), theirs: result.opponentScore, total: result.total })}
          </p>
          <p className="mt-4">
            {result.reward > 0
              ? <CoinAmount amount={t('battle.coinsWon', { coins: result.reward })} className="text-lg text-moss" />
              : <span className="text-sm text-ink-faint">{t('battle.noCoins')}</span>}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/student/battle" className="btn-primary">{t('battle.playAgain')}</Link>
          </div>
        </section>

        <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink">{t('battle.review')}</h2>
        <ol className="space-y-3">
          {result.review.map((item, index) => (
            <li key={item.text} className="rounded-xl border border-line bg-card p-4">
              <p className="text-sm font-semibold text-ink">{index + 1}. {item.text}</p>
              <p className="mt-2 text-sm text-moss">{t('battle.rightAnswer')}: <span className="font-mono">{item.correctAnswer}</span></p>
              {!item.isCorrect && (
                <p className="mt-1 text-sm text-brick">{t('battle.yourAnswer')}: <span className="font-mono">{item.yourAnswer ?? t('battle.noAnswer')}</span></p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
};

export default BattleRoom;
