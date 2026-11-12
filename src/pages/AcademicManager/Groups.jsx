import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import AiPanel from '../../components/AiPanel';
import { SkeletonCard } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';

// One group: change the head teacher, move students to another group, see the AI view of the group.
const GroupCard = ({ group, groups, teachers, onChanged }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const students = useFetch(open ? `/api/groups/${group.id}/students` : null);

  const assign = async (teacherId) => {
    if (!teacherId) return;
    try {
      await api(`/api/academic/groups/${group.id}/teacher`, { method: 'PATCH', body: { teacherId } });
      toast.success(t('common.success_save'));
      onChanged();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const move = async (studentId, toGroupId) => {
    if (!toGroupId) return;
    try {
      await api('/api/academic/transfer', { method: 'POST', body: { studentId, fromGroupId: group.id, toGroupId } });
      toast.success(t('academic.moved'));
      students.reload();
      onChanged();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <li className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{group.name}</h2>
          <p className="text-sm text-ink-soft">{t('groups.studentsCount', { count: group.studentCount })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field !w-auto" value={group.teacherId ?? ''} onChange={(e) => assign(e.target.value)} aria-label={t('academic.teacher')}>
            {teachers.map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
          </select>
          <button className="btn-quiet" onClick={() => setOpen(!open)}>{t('groups.students')}</button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          <ul className="divide-y divide-line rounded-lg border border-line">
            {(students.data?.students ?? []).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-ink">{s.fullName}</span>
                <select className="field !w-auto !py-1.5" value="" onChange={(e) => move(s.id, e.target.value)} aria-label={t('academic.moveTo')}>
                  <option value="">{t('academic.moveTo')}</option>
                  {groups.filter((g) => g.id !== group.id && g.status === 'active').map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </li>
            ))}
          </ul>
          <AiPanel type="group" targetId={group.id} />
        </div>
      )}
    </li>
  );
};

// Academic manager: groups, their teachers and students.
const Groups = () => {
  const { t } = useTranslation();
  const groups = useFetch('/api/groups');
  const teachers = useFetch('/api/academic/teacher-names');

  const list = (groups.data?.groups ?? []).filter((g) => g.status === 'active');

  return (
    <>
      <PageHeader title={t('nav.groups')}>{t('academic.groupsHint')}</PageHeader>
      {groups.loading && <SkeletonCard lines={3} />}
      <ul className="space-y-4">
        {list.map((g) => (
          <GroupCard key={g.id} group={g} groups={groups.data.groups} teachers={teachers.data?.teachers ?? []} onChanged={groups.reload} />
        ))}
      </ul>
    </>
  );
};

export default Groups;
