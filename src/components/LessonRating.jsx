import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { api, errorText } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { formatDate } from '../lib/format';

// Student: the question once a week, "How were the lessons this week?". Buttons 1-5 and an optional comment.
// The answer is anonymous: teachers and the academic manager never see the name. It shows only when there is
// a lesson to rate; once answered it disappears.
const LessonRating = () => {
  const { t, i18n } = useTranslation();
  const { data, reload } = useFetch('/api/ratings/pending');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const lesson = data?.lesson;
  if (!lesson) return null;

  const rate = async (score) => {
    setBusy(true);
    try {
      await api('/api/ratings', { method: 'POST', body: { lessonId: lesson.id, score, comment } });
      toast.success(t('rating.thanks'));
      setComment('');
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{t('rating.title')}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {t('rating.lesson', { topic: lesson.topic, group: lesson.groupName, date: formatDate(lesson.date, i18n.language) })}
      </p>
      <div className="mt-4 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} disabled={busy} onClick={() => rate(n)} className="btn-quiet !px-4 !py-2 text-base font-semibold">{n}</button>
        ))}
      </div>
      <input className="field mt-3" value={comment} maxLength={500} placeholder={t('rating.comment')} onChange={(e) => setComment(e.target.value)} />
      <p className="mt-2 text-xs text-ink-faint">{t('rating.anonymous')}</p>
    </section>
  );
};

export default LessonRating;
