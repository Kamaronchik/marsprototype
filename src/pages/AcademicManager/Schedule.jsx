import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { SkeletonCard } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { weekdayName } from '../../lib/format';

const EMPTY = { groupId: '', weekday: 1, startTime: '', endTime: '' };

// Academic manager: the schedule of every group. Rows come from the schedule table; a group that has
// no rows there shows the weekdays and time set on the group itself (these cannot be deleted here).
const Schedule = () => {
  const { t, i18n } = useTranslation();
  const schedule = useFetch('/api/schedule');
  const groups = useFetch('/api/groups');
  const [form, setForm] = useState(EMPTY);

  const slots = schedule.data?.slots ?? [];
  const set = (name) => (e) => setForm({ ...form, [name]: name === 'weekday' ? Number(e.target.value) : e.target.value });

  const add = async (event) => {
    event.preventDefault();
    try {
      await api('/api/schedule', { method: 'POST', body: form });
      setForm(EMPTY);
      schedule.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const remove = async (slot) => {
    try {
      await api(`/api/schedule/${slot.scheduleId}`, { method: 'DELETE' });
      schedule.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader title={t('nav.schedule')}>{t('academic.scheduleHint')}</PageHeader>

      <form onSubmit={add} className="mb-8 grid gap-3 rounded-xl border border-line bg-card p-5 md:grid-cols-5">
        <select className="field" value={form.groupId} onChange={set('groupId')} aria-label={t('homework.group')}>
          <option value="">{t('homework.group')}</option>
          {(groups.data?.groups ?? []).filter((g) => g.status === 'active').map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="field" value={form.weekday} onChange={set('weekday')} aria-label={t('academic.weekday')}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{weekdayName(d, i18n.language, 'long')}</option>)}
        </select>
        <input type="time" className="field" value={form.startTime} onChange={set('startTime')} aria-label={t('academic.start')} />
        <input type="time" className="field" value={form.endTime} onChange={set('endTime')} aria-label={t('academic.end')} />
        <button className="btn-primary" disabled={!form.groupId || !form.startTime || !form.endTime}>{t('common.add')}</button>
      </form>

      {schedule.loading && <SkeletonCard lines={4} />}
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
            <tr>
              <th className="px-4 py-3">{t('academic.weekday')}</th>
              <th className="px-4 py-3">{t('academic.time')}</th>
              <th className="px-4 py-3">{t('homework.group')}</th>
              <th className="px-4 py-3">{t('academic.teacher')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {slots.map((s) => (
              <tr key={`${s.groupId}-${s.weekday}-${s.startTime}`}>
                <td className="px-4 py-3">{weekdayName(s.weekday, i18n.language, 'long')}</td>
                <td className="px-4 py-3 font-mono">{s.startTime}–{s.endTime}</td>
                <td className="px-4 py-3 font-medium text-ink">{s.groupName}</td>
                <td className="px-4 py-3 text-ink-soft">{s.teacherName}</td>
                <td className="px-4 py-3 text-right">
                  {s.scheduleId && (
                    <button aria-label={t('common.delete')} onClick={() => remove(s)} className="rounded-lg p-1.5 text-ink-faint hover:bg-sunken hover:text-brick"><Trash2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Schedule;
