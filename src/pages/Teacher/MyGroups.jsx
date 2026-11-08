import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { useFetch } from '../../lib/useFetch';
import { weekdaysText } from '../../lib/format';

// Teacher: only the groups where this teacher is the head, with their students.
const MyGroups = () => {
  const { t, i18n } = useTranslation();
  const { data, loading } = useFetch('/api/groups/mine');
  const groups = data?.groups ?? [];

  return (
    <>
      <PageHeader title={t('nav.myGroups')} />

      {groups.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold text-ink">{t('groups.noGroups')}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.id} className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-ink">{g.name}</h2>
              <span className="rounded-md bg-sky-tint px-2 py-1 text-xs font-semibold text-sky">{g.room}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{weekdaysText(g.weekdays, i18n.language)} · {g.startTime}</p>

            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              {t('groups.studentsCount', { count: g.students.length })}
            </h3>
            {g.students.length === 0 && <p className="text-sm text-ink-soft">{t('groups.noStudents')}</p>}
            <ul className="divide-y divide-line">
              {g.students.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken font-display text-sm font-semibold text-ink-soft">
                    {s.fullName.charAt(0)}
                  </span>
                  <span className="text-sm font-medium text-ink">{s.fullName}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
};

export default MyGroups;
