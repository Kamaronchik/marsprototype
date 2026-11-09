import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Check, X, Lock } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { formatDate } from '../../lib/format';

// Teacher: today's lessons. One tick or one cross per student, only during opening hours.
const Attendance = () => {
  const { t, i18n } = useTranslation();
  const { data, loading, reload } = useFetch('/api/attendance/today');

  const lessons = data?.lessons ?? [];
  const hours = { open: data?.open, close: data?.close };

  const mark = async (groupId, studentId, status) => {
    try {
      await api('/api/attendance/mark', { method: 'PUT', body: { groupId, studentId, status } });
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const buttonClass = (active, tone) => {
    if (!active) return 'border-line bg-card text-ink-faint hover:border-ink-faint hover:text-ink';
    return tone === 'ok' ? 'border-moss bg-moss text-on-accent' : 'border-brick bg-brick text-on-accent';
  };

  return (
    <>
      <PageHeader title={t('attendance.title')}>
        {data ? `${formatDate(data.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}. ` : ''}
        {t('attendance.teacherSubtitle')}
      </PageHeader>

      {data && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          data.markingOpen ? 'border-line bg-card text-ink-soft' : 'border-ochre/30 bg-ochre-tint text-ochre'
        }`}>
          {!data.markingOpen && <Lock size={16} className="shrink-0" />}
          {data.markingOpen ? t('attendance.openHours', hours) : t('attendance.closedHours', hours)}
        </div>
      )}

      {lessons.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold text-ink">{t('attendance.noLessons')}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{t('attendance.noLessonsHint')}</p>
        </div>
      )}

      <div className="space-y-5">
        {lessons.map((lesson) => (
          <section key={lesson.groupId} className="overflow-hidden rounded-xl border border-line bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken/60 px-5 py-3.5">
              <h2 className="font-display text-lg font-semibold text-ink">{lesson.groupName}</h2>
              <p className="text-sm text-ink-soft">{lesson.startTime}–{lesson.endTime} · {lesson.room}</p>
            </header>
            <ul className="divide-y divide-line">
              {lesson.students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="flex items-center gap-3 text-sm font-medium text-ink">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken font-display text-sm font-semibold text-ink-soft">
                      {s.fullName.charAt(0)}
                    </span>
                    {s.fullName}
                    {s.status === null && <span className="rounded bg-sunken px-1.5 py-0.5 text-[11px] font-semibold text-ink-faint">{t('attendance.notMarked')}</span>}
                  </span>
                  <span className="flex gap-2">
                    <button
                      onClick={() => mark(lesson.groupId, s.id, 'present')}
                      disabled={!data.markingOpen}
                      aria-label={`${t('attendance.markPresent')}: ${s.fullName}`}
                      aria-pressed={s.status === 'present'}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass(s.status === 'present', 'ok')}`}
                    >
                      <Check size={20} strokeWidth={2.4} />
                    </button>
                    <button
                      onClick={() => mark(lesson.groupId, s.id, 'absent')}
                      disabled={!data.markingOpen}
                      aria-label={`${t('attendance.markAbsent')}: ${s.fullName}`}
                      aria-pressed={s.status === 'absent'}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass(s.status === 'absent', 'bad')}`}
                    >
                      <X size={20} strokeWidth={2.4} />
                    </button>
                  </span>
                </li>
              ))}
              {lesson.students.length === 0 && <li className="px-5 py-6 text-sm text-ink-soft">{t('groups.noStudents')}</li>}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
};

export default Attendance;
