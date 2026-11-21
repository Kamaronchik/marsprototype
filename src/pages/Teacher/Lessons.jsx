import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Check, X, Clock } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { SkeletonCard } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { formatDate } from '../../lib/format';

// The short form after a lesson: topic, a tick or a cross for every student, and (if there is one) the homework.
const LessonForm = ({ lesson, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [topic, setTopic] = useState(lesson.lesson?.topic ?? '');
  const [marks, setMarks] = useState(() => Object.fromEntries(lesson.students.map((s) => [s.id, s.status ?? 'present'])));
  const [hasHomework, setHasHomework] = useState(false);
  const [homework, setHomework] = useState({ title: '', description: '', dueDate: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!topic.trim()) return toast.error(t('lessons.topicRequired'));
    setBusy(true);
    try {
      await api('/api/lessons', {
        method: 'POST',
        body: {
          groupId: lesson.groupId,
          topic,
          attendance: lesson.students.map((s) => ({ studentId: s.id, status: marks[s.id] })),
          homework: hasHomework && homework.title.trim() ? homework : undefined,
        },
      });
      toast.success(t('lessons.saved'));
      onSaved();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  const buttonClass = (active, tone) => {
    if (!active) return 'border-line bg-card text-ink-faint';
    if (tone === 'ok') return 'border-moss bg-moss text-on-accent';
    return tone === 'late' ? 'border-ochre bg-ochre text-on-accent' : 'border-brick bg-brick text-on-accent';
  };

  return (
    <Modal title={`${lesson.groupName} · ${lesson.startTime}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="topic" className="field-label">{t('lessons.topic')}</label>
          <input id="topic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} autoFocus />
        </div>

        <div>
          <p className="field-label">{t('nav.attendance')}</p>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {lesson.students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-ink">{s.fullName}</span>
                <span className="flex gap-2">
                  <button type="button" aria-label={t('attendance.markPresent')} onClick={() => setMarks({ ...marks, [s.id]: 'present' })}
                    className={`rounded-lg border p-1.5 ${buttonClass(marks[s.id] === 'present', 'ok')}`}><Check size={16} /></button>
                  <button type="button" aria-label={t('attendance.markLate')} onClick={() => setMarks({ ...marks, [s.id]: 'late' })}
                    className={`rounded-lg border p-1.5 ${buttonClass(marks[s.id] === 'late', 'late')}`}><Clock size={16} /></button>
                  <button type="button" aria-label={t('attendance.markAbsent')} onClick={() => setMarks({ ...marks, [s.id]: 'absent' })}
                    className={`rounded-lg border p-1.5 ${buttonClass(marks[s.id] === 'absent', 'no')}`}><X size={16} /></button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={hasHomework} onChange={(e) => setHasHomework(e.target.checked)} />
            {t('lessons.addHomework')}
          </label>
          {hasHomework && (
            <div className="mt-3 space-y-3">
              <input className="field" placeholder={t('lessons.homeworkTitle')} value={homework.title} maxLength={120}
                onChange={(e) => setHomework({ ...homework, title: e.target.value })} />
              <textarea className="field" rows={3} placeholder={t('homework.description')} value={homework.description}
                onChange={(e) => setHomework({ ...homework, description: e.target.value })} />
              <input type="date" className="field" value={homework.dueDate} onChange={(e) => setHomework({ ...homework, dueDate: e.target.value })} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-quiet" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={busy}>{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  );
};

// Teacher: today's lessons by the schedule, and the anonymous answers of students about the lessons.
const Lessons = () => {
  const { t, i18n } = useTranslation();
  const today = useFetch('/api/lessons/today');
  const reviews = useFetch('/api/ratings/mine');
  const [open, setOpen] = useState(null);

  const lessons = today.data?.lessons ?? [];

  return (
    <>
      <PageHeader title={t('lessons.todayTitle')}>{t('lessons.todaySubtitle')}</PageHeader>

      {today.loading && <SkeletonCard lines={3} />}
      {!today.loading && lessons.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold text-ink">{t('attendance.noLessons')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t('attendance.noLessonsHint')}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {lessons.map((lesson) => (
          <section key={lesson.groupId} className="rounded-xl border border-line bg-card p-5">
            <p className="font-mono text-xs font-semibold text-ink-faint">{lesson.startTime}–{lesson.endTime} · {t('home.room', { room: lesson.room })}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink">{lesson.groupName}</h2>
            {lesson.lesson && <p className="mt-2 text-sm text-ink-soft">{t('lessons.topic')}: <span className="font-medium text-ink">{lesson.lesson.topic}</span></p>}
            <button className={`mt-4 ${lesson.lesson ? 'btn-quiet' : 'btn-primary'}`} onClick={() => setOpen(lesson)} disabled={!today.data.markingOpen}>
              {lesson.lesson ? t('lessons.edit') : t('lessons.hold')}
            </button>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="mb-1 font-display text-xl font-semibold text-ink">{t('lessons.reviews')}</h2>
        <p className="mb-4 text-sm text-ink-soft">{t('lessons.reviewsHint')}</p>
        {reviews.data && reviews.data.count === 0 && <p className="text-sm text-ink-soft">{t('lessons.noReviews')}</p>}
        {reviews.data && reviews.data.count > 0 && (
          <>
            <p className="mb-3 text-sm text-ink">{t('lessons.average', { value: reviews.data.average, count: reviews.data.count })}</p>
            <ul className="space-y-2">
              {reviews.data.answers.filter((a) => a.comment).slice(0, 20).map((a, i) => (
                <li key={i} className="rounded-lg border border-line bg-card px-4 py-3 text-sm">
                  <span className="font-semibold text-ink">{a.score}/5</span>
                  <span className="text-ink-faint"> · {a.groupName} · {formatDate(a.date, i18n.language)}</span>
                  <p className="mt-1 text-ink-soft">{a.comment}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {open && <LessonForm lesson={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); today.reload(); }} />}
    </>
  );
};

export default Lessons;
