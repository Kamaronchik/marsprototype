import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Download } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { currentMonth, formatDate, todayIso } from '../../lib/format';
import { formatMoney } from '../../lib/money';

const METHODS = ['cash', 'card', 'transfer'];
const EMPTY_FORM = () => ({ studentId: '', amount: '', period: currentMonth(), method: 'cash', note: '', markPaid: true });

// A byte-order mark at the start makes Excel read Cyrillic and Uzbek letters correctly.
const BOM = String.fromCharCode(0xfeff);

// Saves the rows on screen as a CSV file (opens in Excel).
const downloadCsv = (rows, name) => {
  const escape = (cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`;
  const text = rows.map((row) => row.map(escape).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([BOM + text], { type: 'text/csv;charset=utf-8' }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Admin and Financier: every student payment, and a form to record a new one.
const Payments = () => {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState({ from: '', to: '' });
  const [form, setForm] = useState(null);

  const params = new URLSearchParams(Object.entries(range).filter(([, value]) => value));
  const list = useFetch(`/api/finance/payments?${params}`);
  const students = useFetch('/api/students');

  const payments = list.data?.payments ?? [];
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const money = (amount) => formatMoney(amount, i18n.language, t);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api('/api/finance/payments', { method: 'POST', body: { ...form, amount: Number(form.amount) } });
      toast.success(t('finance.paymentSaved'));
      setForm(null);
      list.reload();
      students.reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  const exportCsv = () => downloadCsv(
    [
      [t('finance.date'), t('finance.student'), t('finance.group'), t('finance.period'), t('finance.method'), t('finance.amount'), t('finance.note')],
      ...payments.map((p) => [p.paidAt.slice(0, 10), p.studentName, p.groupName, p.period, t(`finance.${p.method}`), p.amount, p.note]),
    ],
    `payments-${todayIso()}.csv`,
  );

  return (
    <>
      <PageHeader
        title={t('finance.paymentsTitle')}
        action={<button onClick={() => setForm(EMPTY_FORM())} className="btn-primary"><Plus size={17} /> {t('finance.addPayment')}</button>}
      >
        {t('finance.paymentsSubtitle')}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="pay-from" className="field-label">{t('finance.from')}</label>
          <input id="pay-from" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="field" />
        </div>
        <div>
          <label htmlFor="pay-to" className="field-label">{t('finance.to')}</label>
          <input id="pay-to" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="field" />
        </div>
        <button onClick={exportCsv} disabled={payments.length === 0} className="btn-quiet ml-auto">
          <Download size={16} /> {t('finance.exportCsv')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('finance.date')}</th>
              <th className="px-5 py-3">{t('finance.student')}</th>
              <th className="px-5 py-3">{t('finance.group')}</th>
              <th className="px-5 py-3">{t('finance.period')}</th>
              <th className="px-5 py-3">{t('finance.method')}</th>
              <th className="px-5 py-3 text-right">{t('finance.amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-sunken/40">
                <td className="px-5 py-3 text-sm text-ink-soft">{formatDate(p.paidAt, i18n.language)}</td>
                <td className="px-5 py-3 text-sm font-semibold text-ink">{p.studentName}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{p.groupName ?? '—'}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{p.period}</td>
                <td className="px-5 py-3 text-sm text-ink-soft">{t(`finance.${p.method}`)}</td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-ink">{money(p.amount)}</td>
              </tr>
            ))}
            {payments.length === 0 && !list.loading && (
              <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-ink-soft">{t('finance.noPayments')}</td></tr>
            )}
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="border-t border-line bg-sunken/60">
                <td colSpan="5" className="px-5 py-3 text-sm font-semibold text-ink">{t('finance.total')}</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-ink">{money(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {form && (
        <Modal title={t('finance.addPayment')} onClose={() => setForm(null)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="pay-student" className="field-label">{t('finance.student')}</label>
              <select id="pay-student" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="field">
                <option value="">{t('finance.chooseStudent')}</option>
                {(students.data?.students ?? []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pay-amount" className="field-label">{t('finance.amount')}</label>
                <input id="pay-amount" type="number" min="1" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="field" />
              </div>
              <div>
                <label htmlFor="pay-period" className="field-label">{t('finance.period')}</label>
                <input id="pay-period" type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="field" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pay-method" className="field-label">{t('finance.method')}</label>
                <select id="pay-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="field">
                  {METHODS.map((m) => <option key={m} value={m}>{t(`finance.${m}`)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pay-note" className="field-label">{t('finance.note')}</label>
                <input id="pay-note" value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} className="field" />
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input type="checkbox" checked={form.markPaid} onChange={(e) => setForm({ ...form, markPaid: e.target.checked })} className="h-4 w-4 accent-mars" />
              {t('finance.markPaid')}
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className="btn-quiet">{t('common.cancel')}</button>
              <button type="submit" disabled={!form.studentId || !form.amount || !form.period} className="btn-primary">{t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default Payments;
