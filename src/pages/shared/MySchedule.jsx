import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { SkeletonCard } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { tashkentNow, weekdayName } from '../../lib/format';
import { subjectName } from '../../lib/subject';

// Student and Teacher: "My schedule" - the week, day by day, from the school schedule.
const MySchedule = () => {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch('/api/schedule/mine');
  const today = tashkentNow().weekday;
  const days = data?.days ?? [];

  return (
    <>
      <PageHeader title={t('nav.mySchedule')}>{t('schedule.mineHint')}</PageHeader>
      {loading && <SkeletonCard lines={4} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => (
          <section key={day.weekday} className={`rounded-xl border bg-card p-4 ${day.weekday === today ? 'border-mars' : 'border-line'}`}>
            <h2 className="mb-3 flex items-center justify-between font-display text-lg font-semibold text-ink">
              {weekdayName(day.weekday, i18n.language, 'long')}
              {day.weekday === today && <span className="text-xs font-semibold text-mars">{t('schedule.today')}</span>}
            </h2>
            {day.lessons.length === 0 && <p className="text-sm text-ink-faint">{t('schedule.noLessons')}</p>}
            <ul className="space-y-2">
              {day.lessons.map((l) => (
                <li key={`${l.groupId}-${l.startTime}`} className="rounded-lg bg-sunken/60 px-3 py-2 text-sm">
                  <p className="font-semibold text-ink">{l.startTime}–{l.endTime} · {l.groupName}</p>
                  <p className="text-ink-soft">
                    {[subjectName(l.subject, i18n.language), l.room && t('home.room', { room: l.room }), l.teacherName].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
};

export default MySchedule;
