import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import Pager from '../../components/Pager';
import { Skeleton, SkeletonStat } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { api, errorText } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { violationTitle } from './violationTitle';

const PAGE_SIZE = 20;
const TABS = ['issued', 'deducted', 'cancelled', ''];
const COLORS = { issued: 'bg-brick-tint text-brick', deducted: 'bg-moss-tint text-moss', cancelled: 'bg-sunken text-ink-soft' };

const Tile = ({ label, value, alert = false }) => (
  <div className="px-5 py-4">
    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
    <dd className={`mt-1.5 font-display text-2xl font-semibold tracking-tight ${alert ? 'text-brick' : 'text-ink'}`}>{value}</dd>
  </div>
);

// One fine. The CEO takes it from the salary or cancels it (a comment is needed to cancel).
const FineCard = ({ fine, canDecide, onChanged }) => {
  const { t, i18n } = useTranslation();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (path, body) => {
    setBusy(true);
    try {
      await api(`/api/owner/fines/${fine.id}/${path}`, { method: 'POST', body });
      toast.success(t('settings.saved'));
      onChanged();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-line bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/owner/staff/${fine.person.id}`} className="text-sm font-semibold text-ink hover:text-mars">{fine.person.name}</Link>
          <p className="mt-0.5 text-sm text-ink-soft">
            {violationTitle(t, fine)}, {formatDate(fine.details.date, i18n.language)}
          </p>
          <p className="text-xs text-ink-faint">{formatDateTime(fine.issuedAt, i18n.language)}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold text-ink">{formatMoney(fine.amount, i18n.language, t)}</p>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORS[fine.status]}`}>{t(`owner.fineStatus.${fine.status}`)}</span>
        </div>
      </div>

      {fine.comment && <p className="mt-2 text-sm text-ink-soft">{fine.comment}</p>}

      {canDecide && fine.status === 'issued' && (
        <div className="mt-4 border-t border-line pt-4">
          <label htmlFor={`f-${fine.id}`} className="field-label">{t('owner.fineComment')}</label>
          <input id={`f-${fine.id}`} className="field" maxLength="500" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => send('deduct', { comment })}>{t('owner.deduct')}</button>
            <button className="btn-quiet" disabled={busy || comment.trim().length < 3} onClick={() => send('cancel', { comment })}>{t('owner.cancelFine')}</button>
          </div>
        </div>
      )}
    </li>
  );
};

// Fines that the audit system gave to workers by itself: a warning was ignored, so the fine arrived here.
const Fines = () => {
  const { t, i18n } = useTranslation();
  const isCeo = useSelector((state) => state.auth.user?.role) === 'Owner';
  const [tab, setTab] = useState('issued');
  const [page, setPage] = useState(1);
  const list = useFetch(`/api/owner/fines?page=${page}&pageSize=${PAGE_SIZE}${tab ? `&status=${tab}` : ''}`);
  const month = list.data?.month;
  const rows = list.data?.fines ?? [];

  const pick = (value) => { setTab(value); setPage(1); };
  const money = (value) => formatMoney(value, i18n.language, t);

  return (
    <>
      <PageHeader title={t('owner.finesTitle')}>{t('owner.finesHint')}</PageHeader>

      {!month ? (
        <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-card">
          {Array.from({ length: 3 }, (_, i) => <SkeletonStat key={i} />)}
        </dl>
      ) : (
        <dl className="grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-card sm:grid-cols-3 [&>div]:border-b [&>div]:border-line">
          <Tile label={t('owner.monthFines')} value={month.count} />
          <Tile label={t('owner.monthAmount')} value={money(month.amount)} />
          <Tile label={t('owner.monthWaiting')} value={money(month.waiting)} alert={month.waiting > 0} />
        </dl>
      )}

      {month?.topPeople.length > 0 && (
        <p className="mt-4 text-sm text-ink-soft">
          {t('owner.mostFined')}: {month.topPeople.map((p) => `${p.name} (${money(p.amount)})`).join(', ')}
        </p>
      )}

      <div className="mb-5 mt-6 flex flex-wrap gap-2">
        {TABS.map((value) => (
          <button key={value || 'all'} onClick={() => pick(value)} className={tab === value ? 'btn-primary' : 'btn-quiet'}>
            {t(`owner.fineTab.${value || 'all'}`)}
          </button>
        ))}
      </div>

      {list.loading && <Skeleton height="8rem" className="!rounded-xl" />}
      {!list.loading && rows.length === 0 && <p className="rounded-xl border border-line bg-card py-14 text-center text-sm text-ink-soft">{t('owner.noFines')}</p>}

      <ul className="space-y-3">
        {rows.map((fine) => <FineCard key={fine.id + fine.status} fine={fine} canDecide={isCeo} onChanged={list.reload} />)}
      </ul>

      <Pager page={page} total={list.data?.total ?? 0} size={PAGE_SIZE} onPage={setPage} />
    </>
  );
};

export default Fines;
