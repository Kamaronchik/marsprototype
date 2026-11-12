import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import AiPanel from '../../components/AiPanel';
import { SkeletonCard } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { formatDate } from '../../lib/format';

// Academic manager: the quality of teaching. The numbers are counted by the server. The anonymous reviews
// are always shown in full next to the AI summary, so the summary is never the only thing the manager reads.
const Teachers = () => {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch('/api/academic/teachers');
  const [openId, setOpenId] = useState(null);
  const teachers = data?.teachers ?? [];

  return (
    <>
      <PageHeader title={t('nav.teachers')}>{t('academic.teachersHint')}</PageHeader>

      {loading && <SkeletonCard lines={4} />}
      <ul className="space-y-4">
        {teachers.map((x) => (
          <li key={x.teacherId} className="rounded-xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">{x.fullName}</h2>
              <button className="btn-quiet !py-1.5" onClick={() => setOpenId(openId === x.teacherId ? null : x.teacherId)}>{t('academic.analysis')}</button>
            </div>

            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-ink-faint">{t('academic.averageRating')}</dt><dd className="font-semibold text-ink">{x.averageRating ?? '—'} ({x.ratingCount})</dd></div>
              <div><dt className="text-ink-faint">{t('academic.checkedHomework')}</dt><dd className="font-semibold text-ink">{x.checkedHomeworkPercent === null ? '—' : `${x.checkedHomeworkPercent}%`}</dd></div>
              <div><dt className="text-ink-faint">{t('academic.withoutTopic')}</dt><dd className="font-semibold text-ink">{x.lessonsWithoutTopic}</dd></div>
            </dl>

            {openId === x.teacherId && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <AiPanel type="teacher" targetId={x.teacherId} />
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('academic.reviews')}</h3>
                  {x.reviews.length === 0 && <p className="text-sm text-ink-soft">{t('lessons.noReviews')}</p>}
                  <ul className="space-y-2">
                    {x.reviews.map((r, i) => (
                      <li key={i} className="rounded-lg border border-line px-3 py-2 text-sm">
                        <span className="font-semibold text-ink">{r.score}/5</span>
                        <span className="text-ink-faint"> · {r.topic} · {formatDate(r.date, i18n.language)}</span>
                        <p className="mt-1 text-ink-soft">{r.comment}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
};

export default Teachers;
