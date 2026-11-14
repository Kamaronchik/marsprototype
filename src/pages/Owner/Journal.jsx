import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import Pager from '../../components/Pager';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { formatDateTime } from '../../lib/format';
import { useAuditSentence } from '../../lib/useAuditSentence';

const PAGE_SIZE = 25;
const ROLES = ['Owner', 'Admin', 'AcademicManager', 'Teacher', 'Financier', 'Student'];

const Json = ({ label, value }) => (
  <div>
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
    <pre className="max-h-48 overflow-auto rounded-lg bg-sunken p-3 text-xs text-ink">{JSON.stringify(value, null, 2)}</pre>
  </div>
);

// One row of the journal. A click opens the details under it.
const EntryRow = ({ entry, sentence, open, onToggle, language }) => {
  const { t } = useTranslation();
  const hasValues = entry.oldValue || entry.newValue;

  return (
    <>
      <tr className="cursor-pointer hover:bg-sunken/40" onClick={onToggle}>
        <td className="whitespace-nowrap px-5 py-3 text-sm text-ink-soft">{formatDateTime(entry.at, language)}</td>
        <td className="px-5 py-3 text-sm font-semibold text-ink">
          {entry.actor ? (entry.actor.name ?? '—') : t('owner.system')}
          {entry.actor?.role && <span className="block text-xs font-normal text-ink-faint">{t(`roles.${entry.actor.role}`, { defaultValue: entry.actor.role })}</span>}
        </td>
        <td className="px-5 py-3 text-sm text-ink">{sentence}</td>
        <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-faint">{entry.ip ?? '—'}</td>
      </tr>
      {open && (
        <tr className="bg-sunken/30">
          <td colSpan="4" className="px-5 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              {hasValues && <Json label={t('owner.oldValue')} value={entry.oldValue} />}
              {hasValues && <Json label={t('owner.newValue')} value={entry.newValue} />}
              {!hasValues && Object.keys(entry.details).length > 0 && <Json label={t('owner.details')} value={entry.details} />}
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
              {(entry.reasonCode || entry.reasonComment) && (
                <div>
                  <dt className="inline text-ink-faint">{t('owner.reason')}: </dt>
                  <dd className="inline text-ink">{[entry.reasonCode, entry.reasonComment].filter(Boolean).join(' - ')}</dd>
                </div>
              )}
              {entry.userAgent && (
                <div>
                  <dt className="inline text-ink-faint">{t('owner.browser')}: </dt>
                  <dd className="inline break-all text-ink">{entry.userAgent}</dd>
                </div>
              )}
              <div><code className="text-xs text-ink-faint">{entry.action}</code></div>
            </dl>
            {entry.entityId && (
              <Link to={`/owner/history/${entry.entity}/${entry.entityId}`} className="mt-3 inline-block text-sm text-mars">
                {t('owner.openHistory')}
              </Link>
            )}
          </td>
        </tr>
      )}
    </>
  );
};

// The full journal of the school: every filter, old and new values, the reason, the IP.
// ownOnly = the owner's own journal (what the owners looked at and changed).
const Journal = ({ ownOnly = false }) => {
  const { t, i18n } = useTranslation();
  const sentence = useAuditSentence();
  const [filters, setFilters] = useState({ userId: '', role: '', action: '', ip: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
  if (ownOnly) query.set('role', 'Owner');
  const log = useFetch(`/api/owner/log?${query}&page=${page}&pageSize=${PAGE_SIZE}`);
  const staff = useFetch('/api/owner/staff');

  const entries = log.data?.entries ?? [];
  const setFilter = (key) => (event) => { setFilters({ ...filters, [key]: event.target.value }); setPage(1); };

  const exportLink = <a className="btn-quiet" href={`/api/owner/log/export?${query}`}>{t('owner.exportCsv')}</a>;

  return (
    <>
      <PageHeader title={t(ownOnly ? 'owner.myLogTitle' : 'owner.journalTitle')} action={exportLink}>
        {t(ownOnly ? 'owner.myLogHint' : 'owner.journalHint')}
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        {!ownOnly && (
          <>
            <div>
              <label htmlFor="j-user" className="field-label">{t('audit.user')}</label>
              <select id="j-user" className="field pr-8" value={filters.userId} onChange={setFilter('userId')}>
                <option value="">{t('audit.allUsers')}</option>
                {(staff.data?.staff ?? []).map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="j-role" className="field-label">{t('owner.role')}</label>
              <select id="j-role" className="field pr-8" value={filters.role} onChange={setFilter('role')}>
                <option value="">{t('owner.allRoles')}</option>
                {ROLES.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <label htmlFor="j-action" className="field-label">{t('audit.action')}</label>
          <input id="j-action" className="field" placeholder="grade.add" value={filters.action} onChange={setFilter('action')} />
        </div>
        <div>
          <label htmlFor="j-ip" className="field-label">{t('owner.ip')}</label>
          <input id="j-ip" className="field w-40" value={filters.ip} onChange={setFilter('ip')} />
        </div>
        <div>
          <label htmlFor="j-from" className="field-label">{t('attendance.from')}</label>
          <input id="j-from" type="date" className="field" value={filters.from} onChange={setFilter('from')} />
        </div>
        <div>
          <label htmlFor="j-to" className="field-label">{t('attendance.to')}</label>
          <input id="j-to" type="date" className="field" value={filters.to} onChange={setFilter('to')} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('audit.when')}</th>
              <th className="px-5 py-3">{t('audit.who')}</th>
              <th className="px-5 py-3">{t('audit.what')}</th>
              <th className="px-5 py-3">{t('owner.ip')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {log.loading && Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>{Array.from({ length: 4 }, (_, j) => <td key={j} className="px-5 py-3"><SkeletonText width="80%" /></td>)}</tr>
            ))}
            {!log.loading && entries.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                sentence={sentence(e)}
                open={openId === e.id}
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
                language={i18n.language}
              />
            ))}
            {!log.loading && entries.length === 0 && (
              <tr><td colSpan="4" className="px-5 py-14 text-center text-sm text-ink-soft">{t('audit.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={log.data?.total ?? 0} size={PAGE_SIZE} onPage={setPage} />
    </>
  );
};

export default Journal;
