import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { SkeletonText } from '../../components/Skeleton';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { currentMonth, todayIso, formatDate } from '../../lib/format';
import { formatMoney } from '../../lib/money';

const CATEGORIES = ['rent', 'salaries', 'advertising', 'utilities', 'materials', 'other'];

const blank = () => ({ category: 'rent', amount: '', date: todayIso(), comment: '' });

// Admin and Financier: expenses of the school. Add, change, delete (with a question), filter by month and category.
const Expenses = () => {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [category, setCategory] = useState('');
  const [form, setForm] = useState(null); // the expense being edited (has id) or a new one
  const [removing, setRemoving] = useState(null);

  const query = [month && `month=${month}`, category && `category=${category}`].filter(Boolean).join('&');
  const list = useFetch(`/api/finance/expenses${query ? `?${query}` : ''}`);
  const expenses = list.data?.expenses ?? [];
  const money = (amount) => formatMoney(amount, i18n.language, t);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const save = async (event) => {
    event.preventDefault();
    const body = { category: form.category, amount: Number(form.amount), date: form.date, comment: form.comment };
    try {
      await api(form.id ? `/api/finance/expenses/${form.id}` : '/api/finance/expenses', { method: form.id ? 'PATCH' : 'POST', body });
      toast.success(t('expenses.saved'));
      setForm(null);
      list.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const remove = async () => {
    try {
      await api(`/api/finance/expenses/${removing.id}`, { method: 'DELETE' });
      toast.success(t('common.success_delete'));
      setRemoving(null);
      list.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader
        title={t('expenses.title')}
        action={<button className="btn-primary" onClick={() => setForm(blank())}><Plus size={17} /> {t('expenses.add')}</button>}
      >
        {t('expenses.hint')}
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="exp-month" className="field-label">{t('expenses.month')}</label>
          <input id="exp-month" type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div>
          <label htmlFor="exp-cat" className="field-label">{t('expenses.category')}</label>
          <select id="exp-cat" className="field pr-8" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('expenses.allCategories')}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`expenses.categories.${c}`)}</option>)}
          </select>
        </div>
        {month && <button className="btn-quiet" onClick={() => setMonth('')}>{t('expenses.allMonths')}</button>}
        <p className="ml-auto text-sm text-ink-soft">{t('expenses.total')}: <b className="text-ink">{money(list.data?.total ?? 0)}</b></p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('finance.date')}</th>
              <th className="px-5 py-3">{t('expenses.category')}</th>
              <th className="px-5 py-3">{t('expenses.comment')}</th>
              <th className="px-5 py-3 text-right">{t('finance.amount')}</th>
              <th className="px-5 py-3"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.loading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>{Array.from({ length: 5 }, (_, j) => <td key={j} className="px-5 py-3"><SkeletonText width="80%" /></td>)}</tr>
            ))}
            {!list.loading && expenses.map((e) => (
              <tr key={e.id} className="hover:bg-sunken/40">
                <td className="px-5 py-3 text-sm text-ink-soft">{formatDate(e.date, i18n.language)}</td>
                <td className="px-5 py-3 text-sm font-semibold text-ink">{t(`expenses.categories.${e.category}`)}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{e.comment ?? ''}</td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-ink">{money(e.amount)}</td>
                <td className="px-5 py-3 text-right">
                  <button className="btn-quiet" aria-label={t('common.edit')} onClick={() => setForm({ id: e.id, category: e.category, amount: e.amount, date: e.date, comment: e.comment ?? '' })}><Pencil size={16} /></button>
                  <button className="btn-quiet" aria-label={t('common.delete')} onClick={() => setRemoving(e)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {!list.loading && expenses.length === 0 && (
              <tr><td colSpan="5" className="px-5 py-14 text-center text-sm text-ink-soft">{t('expenses.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? t('expenses.edit') : t('expenses.add')} onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="exp-f-cat" className="field-label">{t('expenses.category')}</label>
                <select id="exp-f-cat" className="field" value={form.category} onChange={set('category')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(`expenses.categories.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="exp-f-date" className="field-label">{t('finance.date')}</label>
                <input id="exp-f-date" type="date" className="field" value={form.date} onChange={set('date')} />
              </div>
            </div>
            {form.category === 'salaries' && <p className="text-xs text-ink-soft">{t('expenses.salariesHint')}</p>}
            <div>
              <label htmlFor="exp-f-amount" className="field-label">{t('finance.amount')}</label>
              <input id="exp-f-amount" type="number" min="1" step="1" className="field" value={form.amount} onChange={set('amount')} />
            </div>
            <div>
              <label htmlFor="exp-f-comment" className="field-label">{t('expenses.comment')}</label>
              <input id="exp-f-comment" className="field" maxLength={300} value={form.comment} onChange={set('comment')} />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-quiet" onClick={() => setForm(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={!form.amount || !form.date}>{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {removing && (
        <Modal title={t('expenses.deleteTitle')} onClose={() => setRemoving(null)}>
          <p className="text-sm text-ink-soft">
            {t('expenses.deleteConfirm', { category: t(`expenses.categories.${removing.category}`), amount: money(removing.amount) })}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button className="btn-quiet" onClick={() => setRemoving(null)}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={remove}>{t('common.delete')}</button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default Expenses;
