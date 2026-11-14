import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';

// The people who work at the school, with the number of their violations. A click opens the profile.
const Staff = () => {
  const { t } = useTranslation();
  const staff = useFetch('/api/owner/staff');
  const people = staff.data?.staff ?? [];

  return (
    <>
      <PageHeader title={t('owner.staffTitle')}>{t('owner.staffHint')}</PageHeader>

      {staff.loading && <SkeletonText height="8rem" />}
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('audit.who')}</th>
              <th className="px-5 py-3">{t('owner.role')}</th>
              <th className="px-5 py-3">{t('owner.openCount')}</th>
              <th className="px-5 py-3">{t('owner.totalCount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {people.map((p) => (
              <tr key={p.id} className="hover:bg-sunken/40">
                <td className="px-5 py-3 text-sm font-semibold"><Link to={`/owner/staff/${p.id}`} className="text-ink hover:text-mars">{p.fullName}</Link></td>
                <td className="px-5 py-3 text-sm text-ink-soft">{t(`roles.${p.role}`)}</td>
                <td className={`px-5 py-3 text-sm ${p.open > 0 ? 'font-semibold text-brick' : 'text-ink-soft'}`}>{p.open}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{p.violations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Staff;
