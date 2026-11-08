import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { currentMonth, formatDate } from '../../lib/format';
import { formatMoney } from '../../lib/money';

const EMPTY_FORM = () => ({ teacherId: '', amount: '', period: currentMonth(), note: '' });

// Admin and Financier: what was paid to teachers, and a form to record a new salary.
const Salaries = () => {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(null);

  const list = useFetch('/api/finance/salaries');
  const teachers = useFetch('/api/finance/teachers');

  const salaries = list.data?.salaries ?? [];
  const money = (amount) => formatMoney(amount, i18n.language, t);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api('/api/finance/salaries', { method: 'POST', body: { ...form, amount: Number(form.amount) } });
      toast.success(t('finance.salarySaved'));
      setForm(null);
      list.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader
        title={t('finance.salariesTitle')}
        action={<button onClick={() => setForm(EMPTY_FORM())} className="btn-primary"><Plus size={17} /> {t('finance.addSalary')}</button>}
      >
        {t('finance.salariesSubtitle')}
      </PageHeader>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('finance.date')}</th>
              <th className="px-5 py-3">{t('finance.teacher')}</th>
              <th className="px-5 py-3">{t('finance.period')}</th>
              <th className="px-5 py-3">{t('finance.note')}</th>
              <th className="px-5 py-3 text-right">{t('finance.amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {salaries.map((s) => (
              <tr key={s.id} className="hover:bg-sunken/40">
                <td className="px-5 py-3 text-sm text-ink-soft">{formatDate(s.paidAt, i18n.language)}</td>
                <td className="px-5 py-3 text-sm font-semibold text-ink">{s.teacherName}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{s.period}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{s.note ?? ''}</td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-ink">{money(s.amount)}</td>
              </tr>
            ))}
            {salaries.length === 0 && !list.loading && (
              <tr><td colSpan="5" className="px-5 py-14 text-center text-sm text-ink-soft">{t('finance.noSalaries')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={t('finance.addSalary')} onClose={() => setForm(null)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="sal-teacher" className="field-label">{t('finance.teacher')}</label>
              <select id="sal-teacher" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className="field">
                <option value="">{t('finance.chooseTeacher')}</option>
                {(teachers.data?.teachers ?? []).map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sal-amount" className="field-label">{t('finance.amount')}</label>
                <input id="sal-amount" type="number" min="1" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="field" />
              </div>
              <div>
                <label htmlFor="sal-period" className="field-label">{t('finance.period')}</label>
                <input id="sal-period" type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="field" />
              </div>
            </div>
            <div>
              <label htmlFor="sal-note" className="field-label">{t('finance.note')}</label>
              <input id="sal-note" value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} className="field" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className="btn-quiet">{t('common.cancel')}</button>
              <button type="submit" disabled={!form.teacherId || !form.amount || !form.period} className="btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default Salaries;
