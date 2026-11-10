import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Bot, CheckCircle2, Clock, Send } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonCard } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';

const FILTERS = ['todo', 'submitted', 'graded'];

const STATE_STYLE = {
  todo: 'bg-ochre-tint text-ochre',
  submitted: 'bg-sky-tint text-sky',
  graded: 'bg-moss-tint text-moss',
};

// One homework: the task, the answer form while it is not graded, the mark and comment after.
const HomeworkCard = ({ item, onSent }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(item.answer);
  const [link, setLink] = useState(item.link);
  const [busy, setBusy] = useState(false);

  const send = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/homework/${item.id}/submit`, { method: 'POST', body: { answer, link } });
      toast.success(t('homework.sent'));
      onSent();
      setOpen(false);
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{item.title}</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {item.groupName}
            {item.dueDate && ` · ${t('homework.due')}: ${formatDate(item.dueDate, i18n.language, { day: 'numeric', month: 'long' })}`}
          </p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${item.overdue ? 'bg-brick-tint text-brick' : STATE_STYLE[item.state]}`}>
          {item.overdue ? t('homework.overdue') : t(`homework.state.${item.state}`)}
        </span>
      </div>

      {item.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{item.description}</p>}

      {item.state === 'graded' && (
        <div className="mt-4 rounded-lg bg-moss-tint/60 px-4 py-3">
          <p className="font-display text-2xl font-semibold text-moss">{item.score} / {item.maxScore}</p>
          {item.feedback && <p className="mt-1 text-sm text-ink">{item.feedback}</p>}
        </div>
      )}

      {item.state === 'submitted' && !open && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
          <Clock size={15} /> {t('homework.waiting')}
        </p>
      )}

      {open && item.state !== 'graded' && (
        <form onSubmit={send} className="mt-4 space-y-3">
          <div>
            <label className="field-label" htmlFor={`answer-${item.id}`}>{t('homework.answer')}</label>
            <textarea
              id={`answer-${item.id}`}
              className="field min-h-[7rem] font-mono"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={5000}
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`link-${item.id}`}>{t('homework.link')}</label>
            <input
              id={`link-${item.id}`}
              className="field"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://github.com/…"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || (!answer.trim() && !link.trim())}>
              <Send size={15} /> {t('homework.send')}
            </button>
            <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {!open && item.state !== 'graded' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setOpen(true)}>
            {item.state === 'submitted' ? t('homework.edit') : t('homework.doIt')}
          </button>
          <Link to={`/student/tutor?homework=${item.id}`} className="btn-quiet">
            <Bot size={15} /> {t('homework.askTutor')}
          </Link>
        </div>
      )}
    </article>
  );
};

// Student: the homework of all my groups.
const Homework = () => {
  const { t } = useTranslation();
  const { data, loading, reload } = useFetch('/api/homework/mine');
  const [filter, setFilter] = useState('todo');

  const items = data?.homework ?? [];
  const counts = Object.fromEntries(FILTERS.map((f) => [f, items.filter((h) => h.state === f).length]));
  const shown = items.filter((h) => h.state === filter);

  return (
    <>
      <PageHeader title={t('homework.title')}>{t('homework.studentSubtitle')}</PageHeader>

      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              filter === f ? 'border-mars bg-mars-tint text-mars' : 'border-line bg-card text-ink-soft hover:bg-sunken'
            }`}
          >
            {t(`homework.state.${f}`)} <span className="ml-1 text-ink-faint">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {loading && Array.from({ length: 2 }, (_, i) => <SkeletonCard key={i} lines={3} />)}
        {!loading && shown.map((item) => <HomeworkCard key={`${item.id}-${item.state}`} item={item} onSent={reload} />)}
      </div>

      {!loading && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <CheckCircle2 className="mx-auto mb-3 text-moss" size={28} />
          <p className="font-display text-xl font-semibold text-ink">{t(`homework.empty.${filter}`)}</p>
        </div>
      )}
    </>
  );
};

export default Homework;
