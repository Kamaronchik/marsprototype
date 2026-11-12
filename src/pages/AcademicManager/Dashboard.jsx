import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import { SkeletonCard } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { formatDate } from '../../lib/format';

const Stat = ({ label, value }) => (
  <div className="rounded-xl border border-line bg-card p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
    <p className="mt-2 font-display text-4xl font-semibold text-ink">{value}</p>
  </div>
);

// Academic manager: today in numbers. Everything here is counted by the server, no AI.
const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch('/api/academic/dashboard');

  const sendQuestions = async () => {
    try {
      const result = await api('/api/ratings/send-prompts', { method: 'POST' });
      toast.success(t('academic.promptsSent', { count: result.sent }));
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader
        title={t('nav.overview')}
        action={<button className="btn-quiet" onClick={sendQuestions}>{t('academic.sendWeeklyQuestion')}</button>}
      >
        {t('academic.dashboardHint')}
      </PageHeader>

      {loading && <SkeletonCard lines={3} />}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('academic.lessonsToday')} value={data.lessonsToday} />
            <Stat label={t('academic.withoutTopic')} value={data.lessonsWithoutTopic} />
            <Stat label={t('academic.unmarked')} value={data.unmarkedAttendance} />
            <Stat label={t('academic.ungraded')} value={data.ungradedHomework} />
          </div>

          <h2 className="mb-3 mt-10 font-display text-xl font-semibold text-ink">{t('academic.missingList')}</h2>
          {data.missing.length === 0 && <p className="text-sm text-ink-soft">{t('academic.nothingMissing')}</p>}
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {data.missing.map((m) => (
              <li key={`${m.groupId}-${m.date}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium text-ink">{m.groupName}</span>
                <span className="text-ink-soft">{m.teacherName} · {formatDate(m.date, i18n.language)} {m.startTime}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};

export default Dashboard;
