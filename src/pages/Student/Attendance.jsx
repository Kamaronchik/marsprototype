import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import AttendanceMark from '../../components/AttendanceMark';
import { useFetch } from '../../lib/useFetch';
import { SkeletonRow, SkeletonStat } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';

// Student: own lessons, ticks and crosses, and the attendance percentage.
const Attendance = () => {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch('/api/attendance/mine');

  const records = data?.records ?? [];
  const stats = data?.stats;

  return (
    <>
      <PageHeader title={t('attendance.title')}>{t('attendance.studentSubtitle')}</PageHeader>

      {loading && (
        <dl className="mb-6 grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4 md:divide-x">
          {Array.from({ length: 4 }, (_, i) => <SkeletonStat key={i} />)}
        </dl>
      )}

      {stats && (
        <dl className="mb-6 grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4 md:divide-x">
          <div className="px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('attendance.percent')}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold text-mars">{stats.percent === null ? '—' : `${stats.percent}%`}</dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('attendance.came')}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold text-ink">{stats.present}</dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('attendance.missed')}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold text-ink">{stats.absent}</dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('attendance.lessons')}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold text-ink">{stats.total}</dd>
          </div>
        </dl>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {loading && Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)}
          {!loading && records.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <div className="text-sm font-semibold text-ink">{r.groupName}</div>
                <div className="text-xs text-ink-faint">
                  {formatDate(r.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'long' })}
                  {r.status === 'absent' && ` · ${t('attendance.reason')}: ${r.absenceReason || t('attendance.noReason')}`}
                </div>
              </div>
              <AttendanceMark status={r.status} />
            </li>
          ))}
          {records.length === 0 && !loading && (
            <li className="px-5 py-14 text-center text-sm text-ink-soft">{t('attendance.noMarks')}</li>
          )}
        </ul>
      </div>
    </>
  );
};

export default Attendance;
