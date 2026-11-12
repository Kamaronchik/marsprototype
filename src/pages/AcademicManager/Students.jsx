import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import AiPanel from '../../components/AiPanel';
import { SkeletonCard } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';

// Academic manager: students at risk (3+ absences in two weeks, or marks going down).
// The server counts who is on the list; the AI block under a student only explains it.
const Students = () => {
  const { t } = useTranslation();
  const { data, loading } = useFetch('/api/academic/students/risk');
  const [openId, setOpenId] = useState(null);
  const students = data?.students ?? [];

  return (
    <>
      <PageHeader title={t('nav.atRisk')}>{t('academic.riskHint')}</PageHeader>

      {loading && <SkeletonCard lines={4} />}
      {!loading && students.length === 0 && <p className="text-sm text-ink-soft">{t('academic.noRisk')}</p>}

      <ul className="space-y-3">
        {students.map((s) => (
          <li key={s.studentId} className="rounded-xl border border-line bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{s.fullName}</p>
                <p className="text-sm text-ink-soft">{s.groupName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                {s.reasons.includes('absences') && <span className="rounded-md bg-brick-tint px-2 py-1 text-brick">{t('academic.absences', { count: s.absences })}</span>}
                {s.reasons.includes('falling') && <span className="rounded-md bg-ochre-tint px-2 py-1 text-ochre">{t('academic.falling', { from: s.previousAverage, to: s.recentAverage })}</span>}
                <button className="btn-quiet !py-1.5" onClick={() => setOpenId(openId === s.studentId ? null : s.studentId)}>{t('academic.analysis')}</button>
              </div>
            </div>
            {openId === s.studentId && <div className="mt-3"><AiPanel type="student" targetId={s.studentId} /></div>}
          </li>
        ))}
      </ul>
    </>
  );
};

export default Students;
