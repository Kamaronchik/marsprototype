import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonCard, SkeletonRow } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';

const EMPTY = { groupId: '', title: '', description: '', dueDate: '', maxScore: 10 };

// One student's answer with the mark form.
const SubmissionRow = ({ student, maxScore, onGraded }) => {
  const { t, i18n } = useTranslation();
  const s = student.submission;
  const [score, setScore] = useState(s?.score ?? '');
  const [feedback, setFeedback] = useState(s?.feedback ?? '');
  const [busy, setBusy] = useState(false);

  const grade = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/homework/submissions/${s.id}/grade`, { method: 'PATCH', body: { score: Number(score), feedback } });
      toast.success(t('homework.graded'));
      onGraded();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{student.fullName}</span>
        {!s && <span className="rounded-md bg-ochre-tint px-2 py-0.5 text-xs font-semibold text-ochre">{t('homework.notSent')}</span>}
        {s && s.score !== null && <span className="rounded-md bg-moss-tint px-2 py-0.5 text-xs font-semibold text-moss">{s.score} / {maxScore}</span>}
        {s && s.score === null && <span className="rounded-md bg-sky-tint px-2 py-0.5 text-xs font-semibold text-sky">{t('homework.state.submitted')}</span>}
      </div>

      {s && (
        <>
          <p className="mt-0.5 text-xs text-ink-faint">{formatDate(s.submittedAt, i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          {s.answer && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-sunken px-3 py-2 font-mono text-[13px] text-ink">{s.answer}</pre>}
          {s.link && (
            <a href={s.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-mars hover:underline">
              <ExternalLink size={14} /> {s.link}
            </a>
          )}
          <form onSubmit={grade} className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-24">
              <label className="field-label" htmlFor={`score-${s.id}`}>{t('homework.score')}</label>
              <input id={`score-${s.id}`} type="number" min="0" max={maxScore} className="field" value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="field-label" htmlFor={`fb-${s.id}`}>{t('homework.feedback')}</label>
              <input id={`fb-${s.id}`} className="field" value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={1000} />
            </div>
            <button className="btn-primary" disabled={busy || score === ''}>{s.score === null ? t('homework.grade') : t('homework.regrade')}</button>
          </form>
        </>
      )}
    </li>
  );
};

// The answers of one homework.
const Submissions = ({ homeworkId, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { data, loading, reload } = useFetch(`/api/homework/${homeworkId}/submissions`);

  return (
    <Modal title={data?.homework.title ?? t('homework.answers')} onClose={onClose} size="lg">
      {loading && <ul>{Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)}</ul>}
      {data && (
        <ul className="divide-y divide-line">
          {data.students.map((student) => (
            <SubmissionRow
              key={`${student.id}-${student.submission?.score}-${student.submission?.submittedAt}`}
              student={student}
              maxScore={data.homework.maxScore}
              onGraded={() => { reload(); onChanged(); }}
            />
          ))}
        </ul>
      )}
    </Modal>
  );
};

// Teacher: give homework to a group, read the answers, give marks.
const Homework = () => {
  const { t, i18n } = useTranslation();
  const { data, loading, reload } = useFetch('/api/homework');
  const [form, setForm] = useState(null);
  const [opened, setOpened] = useState(null);
  const [busy, setBusy] = useState(false);

  const groups = data?.groups ?? [];
  const items = data?.homework ?? [];

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/homework', {
        method: 'POST',
        body: { ...form, maxScore: Number(form.maxScore), dueDate: form.dueDate || undefined },
      });
      toast.success(t('homework.created'));
      setForm(null);
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    try {
      await api(`/api/homework/${item.id}`, { method: 'DELETE' });
      toast.success(t('homework.removed'));
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <>
      <PageHeader
        title={t('homework.title')}
        action={groups.length > 0 && (
          <button className="btn-primary" onClick={() => setForm({ ...EMPTY, groupId: groups[0].id })}>
            <Plus size={16} /> {t('homework.new')}
          </button>
        )}
      >
        {t('homework.teacherSubtitle')}
      </PageHeader>

      {loading && <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <SkeletonCard key={i} lines={3} />)}</div>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold text-ink">{groups.length ? t('homework.noneTeacher') : t('groups.noGroups')}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((h) => (
          <article key={h.id} className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold text-ink">{h.title}</h2>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {h.groupName}
                  {h.dueDate && ` · ${t('homework.due')}: ${formatDate(h.dueDate, i18n.language, { day: 'numeric', month: 'long' })}`}
                </p>
              </div>
              <button onClick={() => remove(h)} aria-label={t('homework.remove')} className="rounded-lg p-1.5 text-ink-faint hover:bg-brick-tint hover:text-brick">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {t('homework.progress', { sent: h.submittedCount, total: h.studentCount, graded: h.gradedCount })}
              </p>
              <button className="btn-quiet !py-2" onClick={() => setOpened(h.id)}>{t('homework.answers')}</button>
            </div>
          </article>
        ))}
      </div>

      {form && (
        <Modal title={t('homework.new')} onClose={() => setForm(null)}>
          <form onSubmit={create} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="hw-group">{t('homework.group')}</label>
              <select id="hw-group" className="field" value={form.groupId} onChange={set('groupId')}>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="hw-title">{t('homework.taskTitle')}</label>
              <input id="hw-title" className="field" value={form.title} onChange={set('title')} maxLength={120} required />
            </div>
            <div>
              <label className="field-label" htmlFor="hw-desc">{t('homework.description')}</label>
              <textarea id="hw-desc" className="field min-h-[7rem]" value={form.description} onChange={set('description')} maxLength={5000} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="hw-due">{t('homework.due')}</label>
                <input id="hw-due" type="date" className="field" value={form.dueDate} onChange={set('dueDate')} />
              </div>
              <div>
                <label className="field-label" htmlFor="hw-max">{t('homework.maxScore')}</label>
                <input id="hw-max" type="number" min="1" max="100" className="field" value={form.maxScore} onChange={set('maxScore')} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-quiet" onClick={() => setForm(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" disabled={busy || !form.title.trim()}>{t('homework.give')}</button>
            </div>
          </form>
        </Modal>
      )}

      {opened && <Submissions homeworkId={opened} onClose={() => setOpened(null)} onChanged={reload} />}
    </>
  );
};

export default Homework;
