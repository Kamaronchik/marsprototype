import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Printer, FileSpreadsheet } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { SkeletonCard } from '../../components/Skeleton';
import { errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { currentMonth, todayIso, formatDate } from '../../lib/format';
import { formatMoney } from '../../lib/money';

// First and last day of a 'YYYY-MM' month.
const monthRange = (month) => {
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
};

const Line = ({ label, value, strong }) => (
  <div className={`flex items-center justify-between gap-4 border-b border-line px-5 py-3 text-sm ${strong ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
    <span>{label}</span>
    <span className={strong ? 'text-ink' : ''}>{value}</span>
  </div>
);

// Admin and Financier: the report of a day, a month or any period.
const Reports = () => {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState('month'); // day | month | range
  const [day, setDay] = useState(todayIso());
  const [month, setMonth] = useState(currentMonth());
  const [range, setRange] = useState({ from: todayIso(), to: todayIso() });

  const period = mode === 'day' ? { from: day, to: day } : mode === 'month' ? monthRange(month || currentMonth()) : range;
  const valid = period.from && period.to && period.from <= period.to;
  const { data, loading, error } = useFetch(valid ? `/api/finance/reports?from=${period.from}&to=${period.to}` : null);
  const money = (amount) => formatMoney(amount, i18n.language, t);

  const periodText = data ? `${formatDate(data.from, i18n.language)} – ${formatDate(data.to, i18n.language)}` : '';

  // The library is loaded only when the button is pressed.
  const exportExcel = async () => {
    try {
      const { default: writeExcelFile } = await import('write-excel-file/browser');
      const bold = (value) => ({ value, fontWeight: 'bold' });
      const rows = [
        [bold(t('reports.title')), { value: periodText }],
        [],
        [bold(t('reports.income')), { value: data.income, type: Number }],
        ...data.expenses.byCategory.map((c) => [{ value: t(`expenses.categories.${c.category}`) }, { value: c.amount, type: Number }]),
        [bold(t('reports.expensesTotal')), { value: data.expenses.total, type: Number }],
        [bold(t('reports.teacherSalaries')), { value: data.salaries, type: Number }],
        [bold(t('reports.profit')), { value: data.profit, type: Number }],
        [],
        [bold(t('reports.debtors')), { value: data.debtors.count, type: Number }],
        [bold(t('reports.activeStudents')), { value: data.activeStudents, type: Number }],
      ];
      await writeExcelFile(rows, { columns: [{ width: 34 }, { width: 22 }] }).toFile(`report-${data.from}_${data.to}.xlsx`);
    } catch {
      toast.error(t('reports.exportFailed'));
    }
  };

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        action={
          <div className="flex gap-2 print-hide">
            <button className="btn-quiet" disabled={!data} onClick={exportExcel}><FileSpreadsheet size={17} /> {t('reports.excel')}</button>
            <button className="btn-quiet" disabled={!data} onClick={() => window.print()}><Printer size={17} /> {t('reports.print')}</button>
          </div>
        }
      >
        {t('reports.hint')}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-end gap-4 print-hide">
        <div>
          <label htmlFor="rep-mode" className="field-label">{t('reports.period')}</label>
          <select id="rep-mode" className="field pr-8" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="day">{t('reports.day')}</option>
            <option value="month">{t('reports.month')}</option>
            <option value="range">{t('reports.range')}</option>
          </select>
        </div>
        {mode === 'day' && <input aria-label={t('reports.day')} type="date" className="field !w-auto" value={day} onChange={(e) => setDay(e.target.value)} />}
        {mode === 'month' && <input aria-label={t('reports.month')} type="month" className="field !w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />}
        {mode === 'range' && (
          <>
            <input aria-label={t('attendance.from')} type="date" className="field !w-auto" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <input aria-label={t('attendance.to')} type="date" className="field !w-auto" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </>
        )}
      </div>

      {!valid && <p className="text-sm text-ink-soft">{t('reports.badPeriod')}</p>}
      {loading && valid && <SkeletonCard lines={6} />}
      {error && <p className="text-sm text-brick">{errorText(t, error)}</p>}

      {data && (
        <section className="print-area overflow-hidden rounded-xl border border-line bg-card">
          <h2 className="border-b border-line bg-sunken/60 px-5 py-3.5 font-display text-lg font-semibold text-ink">
            {t('reports.title')}: {periodText}
          </h2>
          <Line label={t('reports.income')} value={money(data.income)} strong />
          <div className="border-b border-line bg-sunken/30 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('reports.expenses')}</div>
          {data.expenses.byCategory.map((c) => (
            <Line key={c.category} label={t(`expenses.categories.${c.category}`)} value={money(c.amount)} />
          ))}
          <Line label={t('reports.expensesTotal')} value={money(data.expenses.total)} strong />
          <Line label={t('reports.teacherSalaries')} value={money(data.salaries)} strong />
          <Line label={t('reports.profit')} value={money(data.profit)} strong />
          <div className="border-b border-line bg-sunken/30 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">{t('reports.students')}</div>
          <Line label={t('reports.debtors')} value={data.debtors.count} />
          <Line label={t('reports.activeStudents')} value={data.activeStudents} />
          {data.debtors.students.length > 0 && (
            <p className="px-5 py-3 text-xs text-ink-soft">{data.debtors.students.map((s) => s.fullName).join(', ')}</p>
          )}
        </section>
      )}
    </>
  );
};

export default Reports;
