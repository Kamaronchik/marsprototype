import { useTranslation } from 'react-i18next';
import AttendanceMark from './AttendanceMark';
import { formatDate } from '../lib/format';

// The latest entries of the mission log: lessons with a tick (came) or a cross (missed).
const MissionLog = ({ entries }) => {
  const { t, i18n } = useTranslation();

  if (entries.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-ink-soft">{t('home.logEmpty')}</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {entries.map((entry) => (
        <li key={`${entry.date}-${entry.groupName}`} className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{entry.groupName}</div>
            <div className="text-xs text-ink-faint">{formatDate(entry.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'long' })}</div>
          </div>
          <AttendanceMark status={entry.status} />
        </li>
      ))}
    </ul>
  );
};

export default MissionLog;
