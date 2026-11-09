import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Gift } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import CoinAmount from '../../components/CoinAmount';
import OrderStatus from '../../components/OrderStatus';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { SkeletonCard } from '../../components/Skeleton';
import { formatDateTime, formatDate } from '../../lib/format';

// Student: own orders. A student can cancel an order until the admin has handed it over.
const Purchases = () => {
  const { t, i18n } = useTranslation();
  const { data, loading, reload } = useFetch('/api/shop/orders');
  const orders = data?.orders ?? [];

  const cancel = async (order) => {
    if (!window.confirm(t('purchases.cancelConfirm'))) return;
    try {
      await api(`/api/shop/orders/${order.id}/cancel`, { method: 'POST' });
      toast.success(t('purchases.cancelled'));
      reload();
    } catch (error) {
      toast.error(errorText(t, error));
    }
  };

  return (
    <>
      <PageHeader title={t('purchases.title')}>{t('purchases.subtitle')}</PageHeader>

      {orders.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-ink-faint/40 bg-card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold text-ink">{t('purchases.empty')}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{t('purchases.emptyHint')}</p>
        </div>
      )}

      <div className="space-y-4">
        {loading && Array.from({ length: 2 }, (_, i) => <SkeletonCard key={i} lines={2} />)}
        {!loading && orders.map((order) => (
          <section key={order.id} className="rounded-xl border border-line bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-3">
                <OrderStatus status={order.status} />
                <span className="text-xs text-ink-faint">{formatDateTime(order.purchasedAt, i18n.language)}</span>
              </div>
              <CoinAmount amount={order.total} className="text-ink" />
            </header>

            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.productName} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sunken text-ink-faint">
                    {item.productImageUrl ? <img src={item.productImageUrl} alt="" className="h-full w-full object-cover" /> : <Gift size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{item.productName}</div>
                    <div className="text-xs text-ink-faint">{item.quantity} × {item.unitPrice}</div>
                  </div>
                </li>
              ))}
            </ul>

            {(order.status === 'Pending' || order.completedAt) && (
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                {order.completedAt && <span className="text-sm text-ink-soft">{t('purchases.handedOn', { date: formatDate(order.completedAt, i18n.language) })}</span>}
                {order.status === 'Pending' && (
                  <button onClick={() => cancel(order)} className="btn-quiet ml-auto !py-1.5 text-sm">{t('purchases.cancel')}</button>
                )}
              </footer>
            )}
          </section>
        ))}
      </div>
    </>
  );
};

export default Purchases;
