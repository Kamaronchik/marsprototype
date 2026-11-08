import { useTranslation } from 'react-i18next';

const STYLE = {
  Pending: 'bg-ochre-tint text-ochre',
  Completed: 'bg-moss-tint text-moss',
  Cancelled: 'bg-sunken text-ink-faint',
};

// Colour badge for an order: waiting for handover, handed over, or cancelled.
const OrderStatus = ({ status }) => {
  const { t } = useTranslation();
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${STYLE[status]}`}>
      {t(`purchases.${status}`)}
    </span>
  );
};

export default OrderStatus;
