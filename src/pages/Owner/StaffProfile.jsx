import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { formatDate, formatDateTime } from '../../lib/format';
import { useAuditSentence } from '../../lib/useAuditSentence';
import StatusBadge from './StatusBadge';

const Block = ({ title, children }) => (
  <section className="rounded-xl border border-line bg-card">
    <h2 className="border-b border-line px-5 py-3 font-display text-lg font-semibold text-ink">{title}</h2>
    {children}
  </section>
);

// One person: their violations, how fast they react, devices of sign-in and the latest actions.
const StaffProfile = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const sentence = useAuditSentence();
  const profile = useFetch(`/api/owner/staff/${id}`);
  const data = profile.data;

  if (!data) return <SkeletonText height="10rem" />;

  return (
    <>
      <PageHeader title={data.person.fullName}>{t(`roles.${data.person.role}`)}</PageHeader>
      <Link to="/owner/staff" className="mb-4 inline-block text-sm text-mars">{t('owner.backToStaff')}</Link>

      <p className="mb-6 text-sm text-ink-soft">
        {t('owner.reaction')}: <span className="font-semibold text-ink">
          {data.averageReactionMinutes == null ? '—' : t('owner.minutes', { count: data.averageReactionMinutes })}
        </span>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block title={t('owner.violationsTitle')}>
          {data.violations.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-soft">{t('owner.noViolations')}</p>}
          <ul className="divide-y divide-line">
            {data.violations.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="block font-semibold text-ink">{v.details.groupName}</span>
                  <span className="text-xs text-ink-faint">{formatDate(v.date, i18n.language)}</span>
                </span>
                <StatusBadge status={v.status} />
              </li>
            ))}
          </ul>
        </Block>

        <Block title={t('owner.devices')}>
          {data.devices.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-soft">{t('audit.empty')}</p>}
          <ul className="divide-y divide-line">
            {data.devices.map((d) => (
              <li key={`${d.ip}${d.userAgent}`} className="px-5 py-3 text-sm">
                <span className="block text-ink">{d.ip ?? '—'} · {formatDateTime(d.lastSeen, i18n.language)}</span>
                <span className="block break-all text-xs text-ink-faint">{d.userAgent}</span>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <div className="mt-6">
        <Block title={t('owner.latestActions')}>
          {data.actions.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-soft">{t('audit.empty')}</p>}
          <ul className="divide-y divide-line">
            {data.actions.map((e) => (
              <li key={e.id} className="px-5 py-3 text-sm">
                <span className="text-ink">{sentence(e)}</span>
                <span className="block text-xs text-ink-faint">{formatDateTime(e.at, i18n.language)} · {e.ip ?? '—'}</span>
              </li>
            ))}
          </ul>
        </Block>
      </div>
    </>
  );
};

export default StaffProfile;
