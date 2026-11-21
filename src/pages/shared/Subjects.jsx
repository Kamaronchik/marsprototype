import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { SkeletonCard } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';

const EMPTY = { name: '', nameRu: '', nameUz: '', nameEn: '' };

// Admin and Academic Manager: the list of subjects. One group has one subject.
const Subjects = () => {
  const { t } = useTranslation();
  const { data, loading, reload } = useFetch('/api/subjects');
  const [form, setForm] = useState(null); // the subject being edited, or a blank one
  const [removing, setRemoving] = useState(null);

  const subjects = data?.subjects ?? [];
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const save = async (event) => {
    event.preventDefault();
    const body = { name: form.name, nameRu: form.nameRu, nameUz: form.nameUz, nameEn: form.nameEn };
    try {
      await api(form.id ? `/api/subjects/${form.id}` : '/api/subjects', { method: form.id ? 'PATCH' : 'POST', body });
      toast.success(t('common.success_save'));
      setForm(null);
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const remove = async () => {
    try {
      await api(`/api/subjects/${removing.id}`, { method: 'DELETE' });
      toast.success(t('common.success_delete'));
      setRemoving(null);
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const edit = (s) => setForm({ id: s.id, name: s.name, nameRu: s.nameRu ?? '', nameUz: s.nameUz ?? '', nameEn: s.nameEn ?? '' });

  return (
    <>
      <PageHeader
        title={t('subjects.title')}
        action={<button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus size={17} /> {t('subjects.add')}</button>}
      >
        {t('subjects.hint')}
      </PageHeader>

      {loading && <SkeletonCard lines={3} />}
      {!loading && subjects.length === 0 && <p className="text-sm text-ink-soft">{t('subjects.empty')}</p>}

      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {subjects.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <p className="font-semibold text-ink">{s.name}</p>
              <p className="text-xs text-ink-soft">
                {[s.nameRu, s.nameUz, s.nameEn].filter(Boolean).join(' / ')}
                {' · '}{t('subjects.groupsCount', { count: s.groupCount })}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-quiet" aria-label={t('common.edit')} onClick={() => edit(s)}><Pencil size={16} /></button>
              <button className="btn-quiet" aria-label={t('common.delete')} onClick={() => setRemoving(s)}><Trash2 size={16} /></button>
            </div>
          </li>
        ))}
      </ul>

      {form && (
        <Modal title={form.id ? t('subjects.edit') : t('subjects.add')} onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label htmlFor="sub-name" className="field-label">{t('subjects.name')}</label>
              <input id="sub-name" className="field" maxLength={60} value={form.name} onChange={set('name')} autoFocus />
            </div>
            <p className="text-xs text-ink-soft">{t('subjects.translationsHint')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="sub-ru" className="field-label">{t('subjects.nameRu')}</label>
                <input id="sub-ru" className="field" maxLength={60} value={form.nameRu} onChange={set('nameRu')} />
              </div>
              <div>
                <label htmlFor="sub-uz" className="field-label">{t('subjects.nameUz')}</label>
                <input id="sub-uz" className="field" maxLength={60} value={form.nameUz} onChange={set('nameUz')} />
              </div>
              <div>
                <label htmlFor="sub-en" className="field-label">{t('subjects.nameEn')}</label>
                <input id="sub-en" className="field" maxLength={60} value={form.nameEn} onChange={set('nameEn')} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-quiet" onClick={() => setForm(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={!form.name.trim()}>{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {removing && (
        <Modal title={t('subjects.deleteTitle')} onClose={() => setRemoving(null)}>
          <p className="text-sm text-ink-soft">{t('subjects.deleteConfirm', { name: removing.name })}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button className="btn-quiet" onClick={() => setRemoving(null)}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={remove}>{t('common.delete')}</button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default Subjects;
