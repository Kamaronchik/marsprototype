import { useTranslation } from 'react-i18next';

const COLORS = {
  reminder: 'bg-sky-tint text-sky',
  green: 'bg-moss-tint text-moss',
  yellow: 'bg-ochre-tint text-ochre',
  red: 'bg-brick-tint text-brick',
  black: 'bg-ink text-paper',
};

// The level of a rule of Mars: Reminder, Green, Yellow, Red, Black.
const LevelBadge = ({ level }) => {
  const { t } = useTranslation();
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORS[level] ?? COLORS.reminder}`}>
      {t(`penalty.level.${level}`)}
    </span>
  );
};

export default LevelBadge;
