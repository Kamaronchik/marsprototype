import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { api, errorText } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import LevelBadge from './LevelBadge';
import { violationTitle } from './violationTitle';

const CLOSED = ['resolved', 'dismissed'];
const STATUS_COLORS = { resolved: 'text-brick', dismissed: 'text-ink-soft' };

// One penalty. The CEO confirms it or cancels it; the auditor can take it back. Both need a reason.
const PenaltyCard = ({ penalty, isCeo, onChanged }) => {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { details } = penalty;
  const open = !CLOSED.includes(penalty.status);

  const close = async (outcome) => {
    setBusy(true);
    try {
      await api(`/api/owner/violations/${penalty.id}/close`, { method: 'POST', body: { outcome, comment: reason.trim() } });
      toast.success(t(outcome === 'resolved' ? 'penalty.confirmed' : 'penalty.removed'));
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
          {penalty.person && (
            <Link to={`/owner/staff/${penalty.person.id}`} className="text-sm font-semibold text-ink hover:text-mars">{penalty.person.name}</Link>
          )}
          <p className="mt-0.5 text-sm text-ink">{violationTitle(t, penalty)}</p>
          <p className="text-xs text-ink-faint">
            {formatDateTime(penalty.detectedAt, i18n.language)} · {t('penalty.by', { name: details.issuedByName ?? '—' })}
            {details.amount > 0 && ` · ${formatMoney(details.amount, i18n.language, t)}`}
          </p>
        </div>
        <div className="text-right">
          <LevelBadge level={details.level} />
          <p className={`mt-1 text-xs font-semibold ${STATUS_COLORS[penalty.status] ?? 'text-ochre'}`}>{t(`penalty.status.${open ? 'open' : penalty.status}`)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-soft">{details.comment}</p>
      {penalty.comment && <p className="mt-2 text-sm text-ink-soft">{t('penalty.reason')}: {penalty.comment}</p>}

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <label htmlFor={`r-${penalty.id}`} className="field-label">{t('penalty.reasonLabel')}</label>
          <input id={`r-${penalty.id}`} className="field" maxLength="500" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            {isCeo && (
              <button className="btn-primary" disabled={busy || reason.trim().length < 3} onClick={() => close('resolved')}>{t('penalty.confirm')}</button>
            )}
            <button className="btn-quiet" disabled={busy || reason.trim().length < 3} onClick={() => close('dismissed')}>{t('penalty.remove')}</button>
          </div>
        </div>
      )}
    </li>
  );
};

export default PenaltyCard;
