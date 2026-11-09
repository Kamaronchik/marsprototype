import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import PageHeader from '../../components/PageHeader';
import CoinAmount from '../../components/CoinAmount';
import OrderStatus from '../../components/OrderStatus';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonText } from '../../components/Skeleton';
import { formatDateTime, formatDate } from '../../lib/format';

const FILTERS = ['', 'Pending', 'Completed', 'Cancelled'];

// Admin: every order of every student. Hand the reward over, then confirm it here.
const ShopOrders = () => {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState('Pending');
  const { data, loading, reload } = useFetch(`/api/admin/shop/orders${status ? `?status=${status}` : ''}`);
  const orders = data?.orders ?? [];

  const act = async (order, action, confirmKey, doneKey) => {
    if (!window.confirm(t(confirmKey))) return;
    try {
      await api(`/api/admin/shop/orders/${order.id}/${action}`, { method: 'POST' });
      toast.success(t(doneKey));
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader title={t('orders.title')}>{t('orders.subtitle')}</PageHeader>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('common.status')}>
        {FILTERS.map((value) => (
          <button
            key={value || 'all'}
            onClick={() => setStatus(value)}
            aria-pressed={status === value}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${
              status === value ? 'border-mars bg-mars-tint text-mars-deep' : 'border-line bg-card text-ink-soft hover:text-ink'
            }`}
          >
            {value ? t(`purchases.${value}`) : t('orders.all')}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[780px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('common.date')}</th>
              <th className="px-5 py-3">{t('orders.student')}</th>
              <th className="px-5 py-3">{t('orders.items')}</th>
              <th className="px-5 py-3">{t('orders.total')}</th>
              <th className="px-5 py-3">{t('common.status')}</th>
              <th className="px-5 py-3"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                {Array.from({ length: 5 }, (_, j) => <td key={j} className="px-5 py-3.5"><SkeletonText width="80%" /></td>)}
                <td className="px-5 py-3.5" />
              </tr>
            ))}
            {!loading && orders.map((order) => (
              <tr key={order.id} className="align-top hover:bg-sunken/40">
                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-ink-soft">{formatDateTime(order.purchasedAt, i18n.language)}</td>
                <td className="px-5 py-3.5">
                  <div className="text-sm font-semibold text-ink">{order.studentName}</div>
                  <div className="text-xs text-ink-faint">{order.studentEmail}</div>
                </td>
                <td className="px-5 py-3.5 text-sm text-ink">
                  {order.items.map((item) => <div key={item.productName}>{item.quantity} × {item.productName}</div>)}
                </td>
                <td className="px-5 py-3.5 text-sm"><CoinAmount amount={order.total} className="text-ink" /></td>
                <td className="whitespace-nowrap px-5 py-3.5">
                  <OrderStatus status={order.status} />
                  {order.completedAt && <div className="mt-1 text-xs text-ink-faint">{t('orders.completedAt', { date: formatDate(order.completedAt, i18n.language) })}</div>}
                </td>
                <td className="px-5 py-3.5">
                  {order.status === 'Pending' && (
                    <div className="flex flex-col items-stretch gap-2">
                      <button onClick={() => act(order, 'deliver', 'orders.deliverConfirm', 'orders.delivered')} className="btn-primary whitespace-nowrap !px-3 !py-1.5 text-xs">
                        {t('orders.deliver')}
                      </button>
                      <button onClick={() => act(order, 'cancel', 'orders.cancelConfirm', 'orders.cancelledMsg')} className="btn-quiet whitespace-nowrap !px-3 !py-1.5 text-xs">
                        {t('orders.cancel')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!loading && orders.length === 0 && (
              <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-ink-soft">{t('orders.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default ShopOrders;
