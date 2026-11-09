import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Search, BellRing } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { weekdaysText } from '../../lib/format';
import { SkeletonAvatar, SkeletonText } from '../../components/Skeleton';

const SEARCH_DELAY_MS = 300;

// Global student directory for the Admin and the Financier. With debts it opens on the debtors.
// One search box finds a student by name, email, group, teacher or room.
const Students = ({ debts = false }) => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const fromBar = searchParams.get('q') ?? '';
  const [text, setText] = useState(fromBar);
  const [query, setQuery] = useState(fromBar.trim());
  const [payment, setPayment] = useState(debts ? 'debtor' : '');
  const [groupId, setGroupId] = useState('');

  // Wait until the user stops typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (payment) params.set('paymentStatus', payment);
  if (groupId) params.set('groupId', groupId);

  const everyone = useFetch('/api/students'); // used for the list of groups in the filter
  const results = useFetch(`/api/students?${params}`);

  const students = results.data?.students ?? [];
  // Rebuilding this (flatMap + a Map + a sort over every student's groups) on every keystroke would
  // be wasted work: it only actually changes when the full roster is reloaded.
  const groupOptions = useMemo(
    () => [...new Map((everyone.data?.students ?? []).flatMap((s) => s.groups).map((g) => [g.id, g])).values()]
      .sort((a, b) => a.name.localeCompare(b.name)),
    [everyone.data],
  );

  const setPaymentStatus = async (student) => {
    const paymentStatus = student.paymentStatus === 'debtor' ? 'active' : 'debtor';
    try {
      await api(`/api/students/${student.id}/payment-status`, { method: 'PATCH', body: { paymentStatus } });
      toast.success(t('students.updated'));
      results.reload();
      everyone.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const remindAll = async () => {
    if (!window.confirm(t('finance.remindConfirm'))) return;
    try {
      const { debtors } = await api('/api/finance/remind-debtors', { method: 'POST' });
      toast.success(t('finance.reminded', { count: debtors }));
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader
        title={debts ? t('finance.debtsTitle') : t('students.title')}
        action={debts && <button onClick={remindAll} className="btn-primary"><BellRing size={17} /> {t('finance.remind')}</button>}
      >
        {debts ? t('finance.debtsSubtitle') : t('students.subtitle')}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={17} />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('students.search')}
            aria-label={t('students.search')}
            className="field pl-10"
          />
        </div>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label={t('students.payment')} className="field w-auto pr-8">
          <option value="">{t('students.allPayments')}</option>
          <option value="active">{t('students.active')}</option>
          <option value="debtor">{t('students.debtor')}</option>
        </select>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label={t('students.group')} className="field w-auto pr-8">
          <option value="">{t('students.allGroups')}</option>
          {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('common.name')}</th>
              <th className="px-5 py-3">{t('students.group')}</th>
              <th className="px-5 py-3">{t('students.payment')}</th>
              <th className="px-5 py-3"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.loading && Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><SkeletonAvatar size="2.25rem" /><div className="space-y-2"><SkeletonText width="9rem" /><SkeletonText width="7rem" height="0.7rem" /></div></div></td>
                <td className="px-5 py-3.5"><SkeletonText width="10rem" /></td>
                <td className="px-5 py-3.5"><SkeletonText width="5rem" height="1.5rem" /></td>
                <td className="px-5 py-3.5"><SkeletonText width="5rem" height="1.8rem" className="ml-auto" /></td>
              </tr>
            ))}
            {!results.loading && students.map((s) => (
              <tr key={s.id} className="align-top hover:bg-sunken/40">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken font-display text-base font-semibold text-ink-soft">
                      {s.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{s.fullName}</div>
                      <div className="truncate text-xs text-ink-faint">@{s.username}{s.email ? ` · ${s.email}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  {s.groups.length === 0 && <span className="text-sm text-ink-faint">{t('students.noGroup')}</span>}
                  {s.groups.map((g) => (
                    <div key={g.id} className="mb-1.5 last:mb-0">
                      <div className="text-sm font-medium text-ink">{g.name} <span className="font-normal text-ink-soft">· {g.room}</span></div>
                      <div className="text-xs text-ink-faint">
                        {weekdaysText(g.weekdays, i18n.language)} · {g.startTime}
                        {g.teacherName ? ` · ${t('students.teacherLine', { name: g.teacherName })}` : ''}
                      </div>
                    </div>
                  ))}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold ${
                    s.paymentStatus === 'debtor' ? 'bg-brick-tint text-brick' : 'bg-moss-tint text-moss'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.paymentStatus === 'debtor' ? 'bg-brick' : 'bg-moss'}`} />
                    {t(`students.${s.paymentStatus}`)}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => setPaymentStatus(s)} className="btn-quiet !px-3 !py-1.5 text-xs">
                    {s.paymentStatus === 'debtor' ? t('students.markPaid') : t('students.markDebtor')}
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && !results.loading && (
              <tr>
                <td colSpan="4" className="px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold text-ink">{t('students.empty')}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t('students.emptyHint')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Students;
