import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Undo2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import CoinAmount from '../../components/CoinAmount';
import { useFetch } from '../../lib/useFetch';
import { formatDateTime } from '../../lib/format';

const TYPE_STYLE = {
  Earn: { icon: ArrowDownLeft, tone: 'bg-moss-tint text-moss' },
  Spend: { icon: ArrowUpRight, tone: 'bg-brick-tint text-brick' },
  Refund: { icon: Undo2, tone: 'bg-sky-tint text-sky' },
};

// Student: balance and the history of every coin movement.
const Coins = () => {
  const { t, i18n } = useTranslation();
  const wallet = useFetch('/api/wallet');
  const history = useFetch('/api/wallet/transactions');

  const transactions = history.data?.transactions ?? [];

  return (
    <>
      <PageHeader title={t('coinsPage.title')}>{t('coinsPage.subtitle')}</PageHeader>

      <div className="mb-8 rounded-xl border border-line bg-card px-6 py-5">
        <p className="text-sm text-ink-soft">{t('coinsPage.balance')}</p>
        <p className="mt-1 text-4xl">
          {wallet.data ? <CoinAmount amount={wallet.data.balance} className="font-display text-ink" /> : '—'}
        </p>
      </div>

      <h2 className="mb-3 font-display text-xl font-semibold text-ink">{t('coinsPage.history')}</h2>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <ul className="divide-y divide-line">
          {transactions.map((tx) => {
            const { icon: Icon, tone } = TYPE_STYLE[tx.type];
            return (
              <li key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{t(`coinsPage.${tx.type}`)}</div>
                  <div className="truncate text-xs text-ink-faint">
                    {tx.description ? `${tx.description} · ` : ''}{formatDateTime(tx.createdAt, i18n.language)}
                  </div>
                </div>
                <span className={`font-display text-lg font-semibold tabular-nums ${tx.amount > 0 ? 'text-moss' : 'text-brick'}`}>
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                </span>
              </li>
            );
          })}
          {transactions.length === 0 && !history.loading && (
            <li className="px-5 py-14 text-center">
              <p className="font-display text-lg font-semibold text-ink">{t('coinsPage.none')}</p>
              <p className="mt-1 text-sm text-ink-soft">{t('coinsPage.noneHint')}</p>
            </li>
          )}
        </ul>
      </div>
    </>
  );
};

export default Coins;
