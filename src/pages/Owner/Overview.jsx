import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import { Skeleton, SkeletonStat } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { api, errorText } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import StatusBadge from './StatusBadge';

const Tile = ({ label, value, alert = false }) => (
  <div className="px-5 py-4">
    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
    <dd className={`mt-1.5 font-display text-3xl font-semibold tracking-tight ${alert ? 'text-brick' : 'text-ink'}`}>{value}</dd>
  </div>
);

// The owner's first page: what needs attention right now.
const Overview = () => {
  const { t, i18n } = useTranslation();
  const overview = useFetch('/api/owner/overview');
  const open = useFetch('/api/owner/violations?status=active&pageSize=5');
  const [checking, setChecking] = useState(false);
  const data = overview.data;

  const checkNow = async () => {
    setChecking(true);
    try {
      const result = await api('/api/owner/rules/run', { method: 'POST' });
      toast.success(t('owner.checkDone', result));
      overview.reload();
      open.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setChecking(false);
    }
  };

  const action = <button className="btn-primary" onClick={checkNow} disabled={checking}>{t('owner.checkNow')}</button>;

  return (
    <>
      <PageHeader title={t('owner.overviewTitle')} action={action}>{t('owner.overviewHint')}</PageHeader>

      {!data ? (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonStat key={i} />)}
        </dl>
      ) : (
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
          <Tile label={t('owner.openViolations')} value={data.openViolations} alert={data.openViolations > 0} />
          <Tile label={t('owner.violationsToday')} value={data.violationsToday} />
          <Tile label={t('owner.actionsToday')} value={data.actionsToday} />
          <Tile label={t('owner.reaction')} value={data.averageReactionMinutes == null ? '—' : t('owner.minutes', { count: data.averageReactionMinutes })} />
        </dl>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-line bg-card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="font-display text-lg font-semibold text-ink">{t('owner.latestOpen')}</h2>
            <Link to="/owner/violations" className="text-sm text-mars">{t('owner.showAll')}</Link>
          </div>
          {!open.data && <Skeleton height="8rem" className="m-5" />}
          {open.data?.violations.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-soft">{t('owner.noOpen')}</p>}
          <ul className="divide-y divide-line">
            {open.data?.violations.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="block font-semibold text-ink">{v.details.groupName}</span>
                  <span className="text-xs text-ink-faint">{v.person?.name} · {formatDateTime(v.detectedAt, i18n.language)}</span>
                </span>
                <StatusBadge status={v.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-card">
          <h2 className="border-b border-line px-5 py-3 font-display text-lg font-semibold text-ink">{t('owner.topOffenders')}</h2>
          {data?.topOffenders.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-soft">{t('owner.noOffenders')}</p>}
          <ul className="divide-y divide-line">
            {data?.topOffenders.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <Link to={`/owner/staff/${p.id}`} className="font-semibold text-ink hover:text-mars">{p.name}</Link>
                <span className="text-ink-soft">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
};

export default Overview;
