import { Check, X, Minus, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// A tick (present), a clock (late), a cross (absent) or a dash (not marked yet), with a text label for screen readers.
const AttendanceMark = ({ status }) => {
  const { t } = useTranslation();

  if (status === 'present') {
    return (
      <span title={t('attendance.present')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-moss-tint text-moss">
        <Check size={16} strokeWidth={2.6} />
        <span className="sr-only">{t('attendance.present')}</span>
      </span>
    );
  }
  if (status === 'late') {
    return (
      <span title={t('attendance.late')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ochre-tint text-ochre">
        <Clock size={15} strokeWidth={2.4} />
        <span className="sr-only">{t('attendance.late')}</span>
      </span>
    );
  }
  if (status === 'absent') {
    return (
      <span title={t('attendance.absent')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brick-tint text-brick">
        <X size={16} strokeWidth={2.6} />
        <span className="sr-only">{t('attendance.absent')}</span>
      </span>
    );
  }
  return (
    <span title={t('attendance.notMarked')} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-ink-faint">
      <Minus size={16} />
      <span className="sr-only">{t('attendance.notMarked')}</span>
    </span>
  );
};

export default AttendanceMark;
