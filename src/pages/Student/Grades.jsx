import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { useFetch } from '../../lib/useFetch';
import { SkeletonCard, SkeletonStat } from '../../components/Skeleton';
import { formatDate } from '../../lib/format';

// Colour of a mark by its percent: green from 80, yellow from 50, red below.
const tone = (percent) => {
  if (percent === null || percent === undefined) return 'text-ink';
  if (percent >= 80) return 'text-moss';
  if (percent >= 50) return 'text-ochre';
  return 'text-brick';
};

// Student: all my marks, grouped by group, with the average.
const Grades = () => {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch('/api/grades/mine');
  const groups = data?.groups ?? [];

  return (
    <>
      <PageHeader title={t('grades.title')}>{t('grades.studentSubtitle')}</PageHeader>

      <dl className="mb-6 grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-card md:divide-x">
        {loading && Array.from({ length: 2 }, (_, i) => <SkeletonStat key={i} />)}
        {data && (
          <>
            <div className="px-5 py-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('grades.average')}</dt>
              <dd className={`mt-1 font-display text-3xl font-semibold ${tone(data.average)}`}>
                {data.average === null ? '—' : `${data.average}%`}
              </dd>
            </div>
            <div className="px-5 py-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('grades.count')}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold text-ink">{data.count}</dd>
            </div>
          </>
        )}
      </dl>

      {loading && <SkeletonCard lines={4} />}

      {!loading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold text-ink">{t('grades.empty')}</p>
        </div>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.groupId} className="overflow-hidden rounded-xl border border-line bg-card">
            <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 className="font-display text-lg font-semibold text-ink">{group.groupName}</h2>
              <span className={`font-display text-xl font-semibold ${tone(group.average)}`}>{group.average}%</span>
            </header>
            <ul className="divide-y divide-line">
              {group.grades.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{g.title}</p>
                    <p className="text-xs text-ink-faint">
                      {t(`grades.kind.${g.kind}`)} · {formatDate(g.createdAt, i18n.language)}
                    </p>
                    {g.comment && <p className="mt-1 text-sm text-ink-soft">{g.comment}</p>}
                  </div>
                  <span className={`shrink-0 font-display text-lg font-semibold ${tone(g.percent)}`}>
                    {g.score}<span className="text-sm text-ink-faint"> / {g.maxScore}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
};

export default Grades;
