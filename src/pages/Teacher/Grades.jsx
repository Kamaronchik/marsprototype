import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonRow } from '../../components/Skeleton';

const KINDS = ['lesson', 'test', 'project'];
const EMPTY = { kind: 'lesson', title: '', score: '', maxScore: 10, comment: '' };

const tone = (percent) => {
  if (percent === null || percent === undefined) return 'text-ink-faint';
  if (percent >= 80) return 'text-moss';
  if (percent >= 50) return 'text-ochre';
  return 'text-brick';
};

// Teacher: the marks of one group, add a mark for a lesson, a test or a project.
// Homework marks come from the Homework page by themselves.
const Grades = () => {
  const { t } = useTranslation();
  const mine = useFetch('/api/groups/mine');
  const groups = mine.data?.groups ?? [];
  const [groupId, setGroupId] = useState('');
  const activeGroup = groupId || groups[0]?.id || null;

  const grades = useFetch(activeGroup ? `/api/grades/group/${activeGroup}` : null);
  const [adding, setAdding] = useState(null); // { student, ...form }
  const [busy, setBusy] = useState(false);

  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/grades', {
        method: 'POST',
        body: {
          studentId: adding.student.id,
          groupId: activeGroup,
          kind: adding.kind,
          title: adding.title,
          score: Number(adding.score),
          maxScore: Number(adding.maxScore),
          comment: adding.comment,
        },
      });
      toast.success(t('grades.added'));
      setAdding(null);
      grades.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (grade) => {
    try {
      await api(`/api/grades/${grade.id}`, { method: 'DELETE' });
      grades.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const set = (key) => (event) => setAdding((prev) => ({ ...prev, [key]: event.target.value }));
  const students = grades.data?.students ?? [];

  return (
    <>
      <PageHeader
        title={t('grades.title')}
        action={groups.length > 1 && (
          <select className="field !w-auto" value={activeGroup ?? ''} onChange={(e) => { setGroupId(e.target.value); setAdding(null); }} aria-label={t('homework.group')}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      >
        {t('grades.teacherSubtitle')}
      </PageHeader>

      {!mine.loading && groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold text-ink">{t('groups.noGroups')}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {(mine.loading || grades.loading) && Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}
          {!grades.loading && students.map((s) => (
            <li key={s.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sunken font-display text-sm font-semibold text-ink-soft">
                    {s.fullName.charAt(0)}
                  </span>
                  <span className="text-sm font-semibold text-ink">{s.fullName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-display text-lg font-semibold ${tone(s.average)}`}>{s.average === null ? '—' : `${s.average}%`}</span>
                  <button className="btn-quiet !py-1.5" onClick={() => setAdding({ ...EMPTY, student: s })}>
                    <Plus size={15} /> {t('grades.add')}
                  </button>
                </div>
              </div>
              {s.grades.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.grades.map((g) => (
                    <li key={g.id} className="group flex items-center gap-1.5 rounded-lg border border-line bg-sunken px-2.5 py-1 text-xs" title={g.comment || ''}>
                      <span className="text-ink-soft">{g.title}</span>
                      <span className={`font-semibold ${tone(g.percent)}`}>{g.score}/{g.maxScore}</span>
                      {!g.fromHomework && (
                        <button onClick={() => remove(g)} aria-label={t('grades.delete')} className="text-ink-faint hover:text-brick">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      {adding && (
        <Modal title={`${t('grades.add')}: ${adding.student.fullName}`} onClose={() => setAdding(null)}>
          <form onSubmit={add} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="gr-kind">{t('grades.type')}</label>
              <select id="gr-kind" className="field" value={adding.kind} onChange={set('kind')}>
                {KINDS.map((k) => <option key={k} value={k}>{t(`grades.kind.${k}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="gr-title">{t('grades.what')}</label>
              <input id="gr-title" className="field" value={adding.title} onChange={set('title')} maxLength={120} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="gr-score">{t('homework.score')}</label>
                <input id="gr-score" type="number" min="0" max={adding.maxScore} className="field" value={adding.score} onChange={set('score')} required />
              </div>
              <div>
                <label className="field-label" htmlFor="gr-max">{t('homework.maxScore')}</label>
                <input id="gr-max" type="number" min="1" max="100" className="field" value={adding.maxScore} onChange={set('maxScore')} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="gr-comment">{t('homework.feedback')}</label>
              <input id="gr-comment" className="field" value={adding.comment} onChange={set('comment')} maxLength={500} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-quiet" onClick={() => setAdding(null)}>{t('common.cancel')}</button>
              <button className="btn-primary" disabled={busy || !adding.title.trim() || adding.score === ''}>{t('grades.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default Grades;
