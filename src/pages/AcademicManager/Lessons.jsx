import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { SkeletonCard } from '../../components/Skeleton';
import { useFetch } from '../../lib/useFetch';
import { formatDate } from '../../lib/format';

// Academic manager: the lesson journal. Topic, teacher, attendance, homework and the average rating
// (a number only: the answers of students are anonymous).
const Lessons = () => {
  const { t, i18n } = useTranslation();
  const [groupId, setGroupId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const groups = useFetch('/api/groups');
  const teachers = useFetch('/api/academic/teacher-names');

  const params = new URLSearchParams();
  if (groupId) params.set('groupId', groupId);
  if (teacherId) params.set('teacherId', teacherId);
  const { data, loading } = useFetch(`/api/lessons?${params}`);
  const lessons = data?.lessons ?? [];

  return (
    <>
      <PageHeader title={t('nav.lessons')}>{t('academic.lessonsHint')}</PageHeader>

      <div className="mb-5 flex flex-wrap gap-3">
        <select className="field !w-auto" value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label={t('homework.group')}>
          <option value="">{t('academic.allGroups')}</option>
          {(groups.data?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="field !w-auto" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label={t('academic.teacher')}>
          <option value="">{t('academic.allTeachers')}</option>
          {(teachers.data?.teachers ?? []).map((x) => <option key={x.id} value={x.id}>{x.fullName}</option>)}
        </select>
      </div>

      {loading && <SkeletonCard lines={4} />}
      {!loading && lessons.length === 0 && <p className="text-sm text-ink-soft">{t('academic.noLessons')}</p>}
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
            <tr>
              <th className="px-4 py-3">{t('common.date')}</th>
              <th className="px-4 py-3">{t('homework.group')}</th>
              <th className="px-4 py-3">{t('lessons.topic')}</th>
              <th className="px-4 py-3">{t('academic.teacher')}</th>
              <th className="px-4 py-3">{t('nav.attendance')}</th>
              <th className="px-4 py-3">{t('nav.homework')}</th>
              <th className="px-4 py-3">{t('academic.rating')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lessons.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(l.date, i18n.language)}</td>
                <td className="px-4 py-3 font-medium text-ink">{l.groupName}</td>
                <td className="px-4 py-3">{l.topic}</td>
                <td className="px-4 py-3 text-ink-soft">{l.teacherName}</td>
                <td className="px-4 py-3">{l.present + l.late} / {l.present + l.late + l.absent}</td>
                <td className="px-4 py-3">{l.homeworkCount}</td>
                <td className="px-4 py-3">{l.averageRating ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Lessons;
