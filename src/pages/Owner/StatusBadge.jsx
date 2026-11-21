import { useTranslation } from 'react-i18next';

const COLORS = {
  open: 'bg-brick-tint text-brick',
  escalated: 'bg-brick-tint text-brick',
  acknowledged: 'bg-sky-tint text-sky',
  resolved: 'bg-moss-tint text-moss',
  dismissed: 'bg-sunken text-ink-soft',
};

// The status of a violation as a small coloured label.
const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORS[status] ?? COLORS.dismissed}`}>
      {t(`owner.status.${status}`)}
    </span>
  );
};

export default StatusBadge;
