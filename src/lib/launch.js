import { weekdayName } from './format';

// "in 45 min", "in 2 h 10 min", "Tomorrow at 11:40", "Wednesday at 11:40" or "Live now".
export const launchWhen = (launch, t, language) => {
  if (launch.live) return t('home.live');
  const minutes = launch.minutesUntil;
  if (minutes < 60) return t('home.inMinutes', { m: minutes });
  if (launch.dayOffset === 0) return t('home.inHours', { h: Math.floor(minutes / 60), m: minutes % 60 });
  if (launch.dayOffset === 1) return t('home.tomorrowAt', { time: launch.startTime });
  return t('home.onDayAt', { day: weekdayName(launch.weekday, language, 'long'), time: launch.startTime });
};

// How close the launch is, as a percentage of one day: it fills up as the lesson approaches.
export const launchProgress = (launch) => {
  if (!launch) return 0;
  if (launch.live) return 100;
  return Math.max(0, Math.min(100, 100 - (launch.minutesUntil / (24 * 60)) * 100));
};
