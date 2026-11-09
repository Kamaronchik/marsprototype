import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { useFetch } from '../../lib/useFetch';
import { formatMoney } from '../../lib/money';
import { formatDate } from '../../lib/format';
import { Skeleton, SkeletonStat } from '../../components/Skeleton';

const Stat = ({ label, value, accent }) => (
  <div className="px-6 py-5">
    <dt className="text-sm text-ink-soft">{label}</dt>
    <dd className={`mt-1 font-display text-2xl font-semibold leading-tight tracking-tight ${accent ? 'text-mars' : 'text-ink'}`}>{value}</dd>
  </div>
);

// Financier front page: this month's numbers and the last six months side by side.
const FinanceOverview = () => {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const base = pathname.startsWith('/admin') ? '/admin' : '/financier';
  const { data } = useFetch('/api/finance/overview');

  if (!data) {
    return (
      <>
        <PageHeader title={t('finance.overviewTitle')}>{t('finance.overviewSubtitle')}</PageHeader>
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-3 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
          {Array.from({ length: 5 }, (_, i) => <SkeletonStat key={i} />)}
        </dl>
        <Skeleton height="16rem" className="mt-8 !rounded-xl" />
      </>
    );
  }

  const money = (amount) => formatMoney(amount, i18n.language, t);
  const peak = Math.max(1, ...data.history.flatMap((h) => [h.revenue, h.salaries]));

  return (
    <>
      <PageHeader title={t('finance.overviewTitle')}>{t('finance.overviewSubtitle')}</PageHeader>

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-card md:grid-cols-3 [&>div]:border-b [&>div]:border-r [&>div]:border-line">
        <Stat label={t('finance.students')} value={data.students} />
        <Stat label={t('finance.debtors')} value={data.debtors} accent={data.debtors > 0} />
        <Stat label={t('finance.revenue')} value={money(data.revenue)} />
        <Stat label={t('finance.salaries')} value={money(data.salaries)} />
        <Stat label={t('finance.net')} value={money(data.revenue - data.salaries)} />
      </dl>

      <section className="mt-8 rounded-xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">{t('finance.history')}</h2>
          <div className="flex gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-moss" />{t('finance.revenueLegend')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky" />{t('finance.salariesLegend')}</span>
          </div>
        </div>

        <ul className="mt-6 grid grid-cols-6 gap-3">
          {data.history.map((h) => (
            <li key={h.month} className="flex flex-col items-center">
              <div className="flex h-44 w-full items-end justify-center gap-1.5">
                <div
                  className="w-1/3 max-w-[28px] rounded-t bg-moss"
                  style={{ height: `${(h.revenue / peak) * 100}%` }}
                  title={`${t('finance.revenueLegend')}: ${money(h.revenue)}`}
                />
                <div
                  className="w-1/3 max-w-[28px] rounded-t bg-sky"
                  style={{ height: `${(h.salaries / peak) * 100}%` }}
                  title={`${t('finance.salariesLegend')}: ${money(h.salaries)}`}
                />
              </div>
              <span className="mt-2 text-xs font-medium text-ink-soft">
                {formatDate(`${h.month}-01`, i18n.language, { month: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.debtors > 0 && (
        <Link to={`${base}/debts`} className="mt-6 inline-flex text-sm font-semibold text-mars hover:text-mars-deep">
          {t('finance.seeDebtors')} →
        </Link>
      )}
    </>
  );
};

export default FinanceOverview;
