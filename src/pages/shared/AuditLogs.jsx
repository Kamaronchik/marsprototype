import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { formatDateTime } from '../../lib/format';
import { useAuditSentence } from '../../lib/useAuditSentence';

const PAGE_SIZE = 25;

// Admin, Academic Manager and Financier. The server shows each role only its own area.
const AuditLogs = () => {
  const { t, i18n } = useTranslation();
  const sentence = useAuditSentence();
  const [filters, setFilters] = useState({ userId: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page, pageSize: PAGE_SIZE });
  Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
  const log = useFetch(`/api/audit?${query}`);
  const people = useFetch('/api/audit/users');

  const entries = log.data?.entries ?? [];
  const pages = Math.max(1, Math.ceil((log.data?.total ?? 0) / PAGE_SIZE));
  const setFilter = (key) => (event) => { setFilters({ ...filters, [key]: event.target.value }); setPage(1); };

  return (
    <>
      <PageHeader title={t('audit.title')}>{t('audit.hint')}</PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="audit-user" className="field-label">{t('audit.user')}</label>
          <select id="audit-user" className="field pr-8" value={filters.userId} onChange={setFilter('userId')}>
            <option value="">{t('audit.allUsers')}</option>
            {(people.data?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-action" className="field-label">{t('audit.action')}</label>
          <input id="audit-action" className="field" placeholder="group.create" value={filters.action} onChange={setFilter('action')} />
        </div>
        <div>
          <label htmlFor="audit-from" className="field-label">{t('attendance.from')}</label>
          <input id="audit-from" type="date" className="field" value={filters.from} onChange={setFilter('from')} />
        </div>
        <div>
          <label htmlFor="audit-to" className="field-label">{t('attendance.to')}</label>
          <input id="audit-to" type="date" className="field" value={filters.to} onChange={setFilter('to')} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('audit.when')}</th>
              <th className="px-5 py-3">{t('audit.who')}</th>
              <th className="px-5 py-3">{t('audit.what')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {log.loading && Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>{Array.from({ length: 3 }, (_, j) => <td key={j} className="px-5 py-3"><SkeletonText width="80%" /></td>)}</tr>
            ))}
            {!log.loading && entries.map((e) => (
              <tr key={e.id} className="hover:bg-sunken/40">
                <td className="whitespace-nowrap px-5 py-3 text-sm text-ink-soft">{formatDateTime(e.at, i18n.language)}</td>
                <td className="px-5 py-3 text-sm font-semibold text-ink">
                  {e.actor ? e.actor.name : t('audit.system')}
                  {e.actor && <span className="block text-xs font-normal text-ink-faint">{t(`roles.${e.actor.role}`, { defaultValue: e.actor.role })}</span>}
                </td>
                <td className="px-5 py-3 text-sm text-ink">{sentence(e)}</td>
              </tr>
            ))}
            {!log.loading && entries.length === 0 && (
              <tr><td colSpan="3" className="px-5 py-14 text-center text-sm text-ink-soft">{t('audit.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
        <span>{t('audit.page', { page, pages })}</span>
        <span className="flex gap-2">
          <button className="btn-quiet" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('audit.prev')}</button>
          <button className="btn-quiet" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('audit.next')}</button>
        </span>
      </div>
    </>
  );
};

export default AuditLogs;
