import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import Pager from '../../components/Pager';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { api, errorText } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import StatusBadge from './StatusBadge';

const PAGE_SIZE = 20;
const TABS = ['active', 'resolved', 'dismissed', ''];
const CLOSED = ['resolved', 'dismissed'];

// The chain of one violation: found, told, escalated, closed. And the buttons to react.
const Chain = ({ id, onChanged }) => {
  const { t, i18n } = useTranslation();
  const chain = useFetch(`/api/owner/violations/${id}`);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const violation = chain.data?.violation;

  const send = async (path, body) => {
    setBusy(true);
    try {
      await api(`/api/owner/violations/${id}/${path}`, { method: 'POST', body });
      toast.success(t('settings.saved'));
      setComment('');
      chain.reload();
      onChanged();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  if (!violation) return <SkeletonText height="4rem" />;

  return (
    <div className="space-y-4">
      <ol className="space-y-1.5 text-sm">
        {chain.data.events.map((e) => (
          <li key={e.id} className="text-ink">
            <span className="text-ink-faint">{formatDateTime(e.at, i18n.language)} · </span>
            {t(`owner.event.${e.kind}`, { who: e.recipient?.name ?? '', channel: e.channel ? t(`owner.channel.${e.channel}`) : '' })}
            {e.comment && e.comment !== 'auto' && <span className="text-ink-soft"> — {e.comment}</span>}
            {e.comment === 'auto' && <span className="text-ink-soft"> ({t('owner.auto')})</span>}
          </li>
        ))}
      </ol>

      {!CLOSED.includes(violation.status) && (
        <div className="rounded-lg border border-line bg-card p-4">
          <label htmlFor={`c-${id}`} className="field-label">{t('owner.closeComment')}</label>
          <textarea id={`c-${id}`} className="field" rows="2" maxLength="500" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            {violation.status !== 'acknowledged' && (
              <button className="btn-quiet" disabled={busy} onClick={() => send('acknowledge')}>{t('owner.acknowledge')}</button>
            )}
            <button className="btn-primary" disabled={busy || comment.trim().length < 3} onClick={() => send('close', { outcome: 'resolved', comment })}>
              {t('owner.markResolved')}
            </button>
            <button className="btn-quiet" disabled={busy || comment.trim().length < 3} onClick={() => send('close', { outcome: 'dismissed', comment })}>
              {t('owner.markDismissed')}
            </button>
          </div>
        </div>
      )}
      {violation.reactionSeconds != null && (
        <p className="text-sm text-ink-soft">{t('owner.reactionTime', { count: Math.max(1, Math.round(violation.reactionSeconds / 60)) })}</p>
      )}
    </div>
  );
};

// All violations of the school with their status.
const Violations = () => {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState('active');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const list = useFetch(`/api/owner/violations?page=${page}&pageSize=${PAGE_SIZE}${tab ? `&status=${tab}` : ''}`);
  const rows = list.data?.violations ?? [];

  const pick = (value) => { setTab(value); setPage(1); setOpenId(null); };

  return (
    <>
      <PageHeader title={t('owner.violationsTitle')}>{t('owner.violationsHint')}</PageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((value) => (
          <button key={value || 'all'} onClick={() => pick(value)} className={tab === value ? 'btn-primary' : 'btn-quiet'}>
            {t(`owner.tab.${value || 'all'}`)}
          </button>
        ))}
      </div>

      {list.loading && <SkeletonText height="8rem" />}
      {!list.loading && rows.length === 0 && <p className="rounded-xl border border-line bg-card py-14 text-center text-sm text-ink-soft">{t('owner.noViolations')}</p>}

      <ul className="space-y-3">
        {rows.map((v) => (
          <li key={v.id} className="rounded-xl border border-line bg-card">
            <button className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left" onClick={() => setOpenId(openId === v.id ? null : v.id)}>
              <span>
                <span className="block text-sm font-semibold text-ink">{t(`owner.rule.${v.ruleCode}`)}: {v.details.groupName}</span>
                <span className="text-xs text-ink-faint">
                  {v.person?.name} · {formatDate(v.date, i18n.language)} · {formatDateTime(v.detectedAt, i18n.language)}
                </span>
              </span>
              <StatusBadge status={v.status} />
            </button>
            {openId === v.id && (
              <div className="border-t border-line px-5 py-4">
                {v.person && <Link to={`/owner/staff/${v.person.id}`} className="mb-3 inline-block text-sm text-mars">{t('owner.openProfile')}</Link>}
                <Chain id={v.id} onChanged={list.reload} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <Pager page={page} total={list.data?.total ?? 0} size={PAGE_SIZE} onPage={setPage} />
    </>
  );
};

export default Violations;
