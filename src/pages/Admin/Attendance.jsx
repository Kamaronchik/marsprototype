import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import AttendanceMark from '../../components/AttendanceMark';
import { useFetch } from '../../lib/useFetch';
import { SkeletonText } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';

const Stat = ({ label, value }) => (
  <div className="px-5 py-4">
    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
    <dd className="mt-1 font-display text-2xl font-semibold text-ink">{value}</dd>
  </div>
);

// Admin: all attendance marks with filters and statistics, and the lessons nobody has marked yet.
const Attendance = () => {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState('marks');
  const [filters, setFilters] = useState({ from: '', to: '', groupId: '', status: '' });

  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const marks = useFetch(`/api/attendance?${params}`);
  const unmarked = useFetch(`/api/attendance/unmarked?${new URLSearchParams([...params].filter(([key]) => key === 'from' || key === 'to'))}`);
  const groups = useFetch('/api/groups');

  const records = marks.data?.records ?? [];
  const stats = marks.data?.stats;
  const lessons = unmarked.data?.lessons ?? [];
  const setFilter = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });
  const activeGroups = useMemo(() => (groups.data?.groups ?? []).filter((g) => g.status === 'active'), [groups.data]);

  const tabClass = (name) => `border-b-2 px-1 pb-3 text-sm font-semibold ${
    tab === name ? 'border-mars text-ink' : 'border-transparent text-ink-faint hover:text-ink'
  }`;

  return (
    <>
      <PageHeader title={t('attendance.title')}>{t('attendance.adminSubtitle')}</PageHeader>

      <div className="mb-5 flex gap-6 border-b border-line">
        <button onClick={() => setTab('marks')} className={tabClass('marks')}>{t('attendance.tabMarks')}</button>
        <button onClick={() => setTab('unmarked')} className={tabClass('unmarked')}>
          {t('attendance.tabUnmarked')}
          {lessons.length > 0 && <span className="ml-2 rounded-full bg-mars px-2 py-0.5 text-[11px] font-bold text-on-accent">{lessons.length}</span>}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="att-from" className="field-label">{t('attendance.from')}</label>
          <input id="att-from" type="date" value={filters.from} onChange={setFilter('from')} className="field" />
        </div>
        <div>
          <label htmlFor="att-to" className="field-label">{t('attendance.to')}</label>
          <input id="att-to" type="date" value={filters.to} onChange={setFilter('to')} className="field" />
        </div>
        {tab === 'marks' && (
          <>
            <div>
              <label htmlFor="att-group" className="field-label">{t('attendance.group')}</label>
              <select id="att-group" value={filters.groupId} onChange={setFilter('groupId')} className="field pr-8">
                <option value="">{t('attendance.allGroups')}</option>
                {activeGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="att-status" className="field-label">{t('attendance.status')}</label>
              <select id="att-status" value={filters.status} onChange={setFilter('status')} className="field pr-8">
                <option value="">{t('attendance.allStatuses')}</option>
                <option value="present">{t('attendance.present')}</option>
                <option value="late">{t('attendance.late')}</option>
                <option value="absent">{t('attendance.absent')}</option>
              </select>
            </div>
          </>
        )}
      </div>

      {tab === 'marks' && (
        <>
          {stats && (
            <dl className="mb-4 grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-card md:grid-cols-5 md:divide-x">
              <Stat label={t('attendance.came')} value={stats.present} />
              <Stat label={t('attendance.late')} value={stats.late} />
              <Stat label={t('attendance.missed')} value={stats.absent} />
              <Stat label={t('attendance.lessons')} value={stats.total} />
              <Stat label={t('attendance.percent')} value={stats.percent === null ? '—' : `${stats.percent}%`} />
            </dl>
          )}
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  <th className="px-5 py-3">{t('attendance.date')}</th>
                  <th className="px-5 py-3">{t('attendance.student')}</th>
                  <th className="px-5 py-3">{t('attendance.group')}</th>
                  <th className="px-5 py-3">{t('attendance.status')}</th>
                  <th className="px-5 py-3">{t('attendance.reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {marks.loading && Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }, (_, j) => <td key={j} className="px-5 py-3"><SkeletonText width="80%" /></td>)}</tr>
                ))}
                {!marks.loading && records.map((r) => (
                  <tr key={r.id} className="hover:bg-sunken/40">
                    <td className="px-5 py-3 text-sm text-ink-soft">{formatDate(r.date, i18n.language)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-ink">{r.studentName}</td>
                    <td className="px-5 py-3 text-sm text-ink-soft">{r.groupName}</td>
                    <td className="px-5 py-3"><AttendanceMark status={r.status} /></td>
                    <td className="px-5 py-3 text-sm text-ink-soft">{r.status === 'absent' ? (r.absenceReason || t('attendance.noReason')) : ''}</td>
                  </tr>
                ))}
                {!marks.loading && records.length === 0 && (
                  <tr><td colSpan="5" className="px-5 py-14 text-center text-sm text-ink-soft">{t('attendance.noMarks')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'unmarked' && (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3">{t('attendance.date')}</th>
                <th className="px-5 py-3">{t('attendance.group')}</th>
                <th className="px-5 py-3">{t('attendance.teacher')}</th>
                <th className="px-5 py-3">{t('attendance.lesson')}</th>
                <th className="px-5 py-3">{t('attendance.notMarked')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {unmarked.loading && Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 5 }, (_, j) => <td key={j} className="px-5 py-3"><SkeletonText width="80%" /></td>)}</tr>
              ))}
              {!unmarked.loading && lessons.map((l) => (
                <tr key={`${l.groupId}-${l.date}`} className="hover:bg-sunken/40">
                  <td className="px-5 py-3 text-sm text-ink-soft">{formatDate(l.date, i18n.language)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-ink">{l.groupName}</td>
                  <td className="px-5 py-3 text-sm text-ink-soft">{l.teacherName}</td>
                  <td className="px-5 py-3 text-sm text-ink-soft">{l.startTime} · {l.room}</td>
                  <td className="px-5 py-3 text-sm font-medium text-brick">{t('attendance.unmarkedOf', { count: l.unmarkedCount, total: l.studentCount })}</td>
                </tr>
              ))}
              {!unmarked.loading && lessons.length === 0 && (
                <tr><td colSpan="5" className="px-5 py-14 text-center text-sm text-ink-soft">{t('attendance.noUnmarked')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default Attendance;
