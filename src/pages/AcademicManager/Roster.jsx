import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { SkeletonText } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';

// Academic manager: every student with the groups they are in. No payments here, that is the finance area.
const Roster = () => {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [groupId, setGroupId] = useState('');
  const query = [q.trim() && `q=${encodeURIComponent(q.trim())}`, groupId && `groupId=${groupId}`].filter(Boolean).join('&');
  const list = useFetch(`/api/academic/students${query ? `?${query}` : ''}`);
  const groups = useFetch('/api/groups');

  const students = list.data?.students ?? [];
  const activeGroups = (groups.data?.groups ?? []).filter((g) => g.status === 'active');

  return (
    <>
      <PageHeader title={t('nav.students')}>{t('academic.rosterHint')}</PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="roster-q" className="field-label">{t('common.search')}</label>
          <input id="roster-q" className="field" value={q} placeholder={t('academic.searchStudents')} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="roster-group" className="field-label">{t('attendance.group')}</label>
          <select id="roster-group" className="field pr-8" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">{t('attendance.allGroups')}</option>
            {activeGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <p className="ml-auto text-sm text-ink-soft">{t('academic.studentsTotal', { count: students.length })}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[480px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('attendance.student')}</th>
              <th className="px-5 py-3">{t('nav.groups')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.loading && Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>{Array.from({ length: 2 }, (_, j) => <td key={j} className="px-5 py-3"><SkeletonText width="70%" /></td>)}</tr>
            ))}
            {!list.loading && students.map((s) => (
              <tr key={s.id} className="hover:bg-sunken/40">
                <td className="px-5 py-3 text-sm font-semibold text-ink">
                  {s.fullName}
                  {s.frozen && <span className="ml-2 rounded bg-sky-tint px-1.5 py-0.5 text-[11px] font-semibold text-sky">{t('academic.frozen')}</span>}
                </td>
                <td className="px-5 py-3 text-sm text-ink-soft">{s.groups.map((g) => g.name).join(', ') || '—'}</td>
              </tr>
            ))}
            {!list.loading && students.length === 0 && (
              <tr><td colSpan="2" className="px-5 py-14 text-center text-sm text-ink-soft">{t('academic.noStudentsFound')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Roster;
