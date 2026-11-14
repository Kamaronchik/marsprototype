import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Archive, ChevronDown, ChevronRight, UserPlus, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { SkeletonText } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { weekdayName, weekdaysText } from '../../lib/format';
import { subjectName } from '../../lib/subject';

const EMPTY_FORM = { name: '', teacherId: '', subjectId: '', room: '', weekdays: [], startTime: '', monthlyPrice: '' };

// Buttons that can be greyed out: used for lesson times and rooms.
const choiceClass = (selected, disabled) => {
  if (disabled) return 'cursor-not-allowed border-line bg-sunken text-ink-faint line-through';
  if (selected) return 'border-mars bg-mars-tint text-mars-deep font-semibold';
  return 'border-line bg-card text-ink hover:border-ink-faint';
};

// The students of one group, with add and remove.
const GroupStudents = ({ group, allStudents, onChange }) => {
  const { t } = useTranslation();
  const { data, reload } = useFetch(`/api/groups/${group.id}/students`);
  const [picked, setPicked] = useState('');

  const members = data?.students ?? [];
  const candidates = allStudents.filter((s) => !members.some((m) => m.id === s.id));

  const refresh = () => { reload(); onChange(); };

  const add = async () => {
    if (!picked) return;
    try {
      await api(`/api/groups/${group.id}/students`, { method: 'POST', body: { studentId: picked } });
      toast.success(t('groups.added'));
      setPicked('');
      refresh();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const remove = async (studentId) => {
    try {
      await api(`/api/groups/${group.id}/students/${studentId}`, { method: 'DELETE' });
      toast.info(t('groups.removed'));
      refresh();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <div className="space-y-3 bg-sunken/50 px-5 py-4">
      {members.length === 0 && <p className="text-sm text-ink-soft">{t('groups.noStudents')}</p>}
      <ul className="flex flex-wrap gap-2">
        {members.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg border border-line bg-card py-1.5 pl-3 pr-1.5 text-sm text-ink">
            {s.fullName}
            <button
              onClick={() => remove(s.id)}
              aria-label={`${t('groups.remove')}: ${s.fullName}`}
              className="rounded p-1 text-ink-faint hover:bg-brick-tint hover:text-brick"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <select value={picked} onChange={(e) => setPicked(e.target.value)} className="field w-auto min-w-[14rem]" aria-label={t('groups.chooseStudent')}>
          <option value="">{t('groups.chooseStudent')}</option>
          {candidates.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <button onClick={add} disabled={!picked} className="btn-quiet">
          <UserPlus size={16} /> {t('groups.addStudent')}
        </button>
      </div>
    </div>
  );
};

const Groups = () => {
  const { t, i18n } = useTranslation();
  const groupsQuery = useFetch('/api/groups');
  const optionsQuery = useFetch('/api/groups/options');
  const usersQuery = useFetch('/api/users');
  const subjectsQuery = useFetch('/api/subjects');
  const studentsQuery = useFetch('/api/students');

  const [editing, setEditing] = useState(null); // null = closed, {} = new group, {id,...} = existing
  const [form, setForm] = useState(EMPTY_FORM);
  const [opened, setOpened] = useState(null);

  // Recomputed only when the underlying request answers again, not on every keystroke in the modal.
  const groups = useMemo(() => (groupsQuery.data?.groups ?? []).filter((g) => g.status === 'active'), [groupsQuery.data]);
  const options = optionsQuery.data;
  const teachers = useMemo(
    () => (usersQuery.data?.users ?? []).filter((u) => u.role === 'Teacher' && u.status === 'active'),
    [usersQuery.data],
  );
  const allStudents = studentsQuery.data?.students ?? [];

  // Another active group that overlaps the form on at least one weekday.
  const overlapping = (g) => g.id !== editing?.id && g.weekdays.some((d) => form.weekdays.includes(d));
  const teacherBusy = (start) => !!form.teacherId && groups.some((g) => overlapping(g) && g.startTime === start && g.teacherId === form.teacherId);
  const roomBusy = (room) => !!form.startTime && groups.some((g) => overlapping(g) && g.startTime === form.startTime && g.room === room);

  const openForm = (group) => {
    setEditing(group ?? {});
    setForm(group
      ? { name: group.name, teacherId: group.teacherId, subjectId: group.subjectId ?? '', room: group.room, weekdays: group.weekdays, startTime: group.startTime, monthlyPrice: group.monthlyPrice || '' }
      : EMPTY_FORM);
  };

  const toggleDay = (day) => setForm((current) => ({
    ...current,
    weekdays: current.weekdays.includes(day) ? current.weekdays.filter((d) => d !== day) : [...current.weekdays, day],
  }));

  const submit = async (event) => {
    event.preventDefault();
    const body = {
      name: form.name,
      teacherId: form.teacherId,
      subjectId: form.subjectId || null,
      room: form.room,
      weekdays: form.weekdays,
      startTime: form.startTime,
      monthlyPrice: form.monthlyPrice === '' ? undefined : Number(form.monthlyPrice),
    };
    try {
      if (editing.id) {
        await api(`/api/groups/${editing.id}`, { method: 'PATCH', body });
        toast.success(t('groups.updated'));
      } else {
        await api('/api/groups', { method: 'POST', body });
        toast.success(t('groups.created'));
      }
      setEditing(null);
      groupsQuery.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const archive = async (group) => {
    if (!window.confirm(t('groups.archiveConfirm'))) return;
    try {
      await api(`/api/groups/${group.id}`, { method: 'DELETE' });
      toast.info(t('groups.archived'));
      groupsQuery.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const formReady = form.name.trim() && form.teacherId && form.room && form.weekdays.length && form.startTime;

  return (
    <>
      <PageHeader
        title={t('groups.title')}
        action={<button onClick={() => openForm()} className="btn-primary"><Plus size={17} /> {t('groups.add')}</button>}
      >
        {t('groups.subtitle')}
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('groups.name')}</th>
              <th className="px-5 py-3">{t('groups.teacher')}</th>
              <th className="px-5 py-3">{t('groups.room')}</th>
              <th className="px-5 py-3">{t('groups.days')}</th>
              <th className="px-5 py-3">{t('groups.time')}</th>
              <th className="px-5 py-3">{t('groups.students')}</th>
              <th className="px-5 py-3"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {groupsQuery.loading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }, (_, j) => <td key={j} className="px-5 py-3.5"><SkeletonText width="80%" /></td>)}
                <td className="px-4 py-3.5" />
              </tr>
            ))}
            {!groupsQuery.loading && groups.map((g) => (
              <Fragment key={g.id}>
                <tr className="hover:bg-sunken/40">
                  <td className="px-5 py-3.5 text-sm font-semibold text-ink">
                    {g.name}
                    {g.subject && <span className="block text-xs font-normal text-ink-soft">{subjectName(g.subject, i18n.language)}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-ink-soft">{g.teacherName}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-ink">{g.room}</td>
                  <td className="px-5 py-3.5 text-sm text-ink-soft">{weekdaysText(g.weekdays, i18n.language)}</td>
                  <td className="px-5 py-3.5 text-sm text-ink-soft">{g.startTime}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => setOpened(opened === g.id ? null : g.id)}
                      aria-expanded={opened === g.id}
                      title={t('groups.showStudents')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
                    >
                      {opened === g.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {t('groups.studentsCount', { count: g.studentCount })}
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openForm(g)} aria-label={`${t('common.edit')}: ${g.name}`} className="rounded-lg p-2 text-ink-faint hover:bg-sunken hover:text-ink">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => archive(g)} aria-label={`${t('groups.archive')}: ${g.name}`} className="rounded-lg p-2 text-ink-faint hover:bg-brick-tint hover:text-brick">
                        <Archive size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                {opened === g.id && (
                  <tr>
                    <td colSpan="7" className="p-0">
                      <GroupStudents group={g} allStudents={allStudents} onChange={groupsQuery.reload} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {groups.length === 0 && !groupsQuery.loading && (
              <tr>
                <td className="px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold text-ink">{t('groups.noGroups')}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t('groups.noGroupsHint')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && options && (
        <Modal size="lg" title={editing.id ? t('groups.editTitle') : t('groups.addTitle')} onClose={() => setEditing(null)}>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="group-name" className="field-label">{t('groups.name')}</label>
                <input id="group-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" maxLength={60} />
              </div>
              <div>
                <label htmlFor="group-teacher" className="field-label">{t('groups.teacher')}</label>
                <select id="group-teacher" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className="field">
                  <option value="">{t('groups.chooseTeacher')}</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="group-subject" className="field-label">{t('subjects.subject')}</label>
              <select id="group-subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className="field">
                <option value="">{t('subjects.none')}</option>
                {(subjectsQuery.data?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{subjectName(s, i18n.language)}</option>)}
              </select>
            </div>

            <fieldset>
              <legend className="field-label">{t('groups.days')}</legend>
              <div className="flex flex-wrap gap-2">
                {options.weekdays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={form.weekdays.includes(day)}
                    onClick={() => toggleDay(day)}
                    className={`rounded-lg border px-3.5 py-2 text-sm ${choiceClass(form.weekdays.includes(day), false)}`}
                  >
                    {weekdayName(day, i18n.language)}
                  </button>
                ))}
              </div>
              {form.weekdays.length === 0 && <p className="mt-2 text-xs text-ink-faint">{t('groups.pickDaysFirst')}</p>}
            </fieldset>

            <fieldset>
              <legend className="field-label">{t('groups.time')}</legend>
              <div className="flex flex-wrap gap-2">
                {options.slots.map((slot) => {
                  const busy = teacherBusy(slot.start);
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      disabled={busy}
                      aria-pressed={form.startTime === slot.start}
                      onClick={() => setForm({ ...form, startTime: slot.start, room: roomBusy(form.room) ? '' : form.room })}
                      title={busy ? t('groups.taken') : undefined}
                      className={`rounded-lg border px-3.5 py-2 text-sm ${choiceClass(form.startTime === slot.start, busy)}`}
                    >
                      {slot.start}–{slot.end}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ink-faint">{t('groups.breakNote', { lesson: options.lessonMinutes, break: options.breakMinutes })}</p>
            </fieldset>

            <fieldset>
              <legend className="field-label">{t('groups.room')}</legend>
              <div className="grid grid-cols-4 gap-2 sm:w-80">
                {options.rooms.map((room) => {
                  const busy = roomBusy(room);
                  return (
                    <button
                      key={room}
                      type="button"
                      disabled={busy}
                      aria-pressed={form.room === room}
                      onClick={() => setForm({ ...form, room })}
                      title={busy ? t('groups.taken') : undefined}
                      className={`rounded-lg border py-2 text-sm ${choiceClass(form.room === room, busy)}`}
                    >
                      {room}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="sm:w-1/2">
              <label htmlFor="group-price" className="field-label">
                {t('groups.price')} <span className="font-normal text-ink-faint">({t('groups.priceOptional')})</span>
              </label>
              <input id="group-price" type="number" min="0" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} className="field" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn-quiet">{t('common.cancel')}</button>
              <button type="submit" disabled={!formReady} className="btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default Groups;
