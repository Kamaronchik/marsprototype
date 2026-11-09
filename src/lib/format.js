const LOCALES = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-GB' };

// Browsers have no month and day names for Uzbek (they print "M11"), so Uzbek uses its own lists.
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_WEEKDAYS_LONG = ['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'];
const UZ_WEEKDAYS_SHORT = ['du', 'se', 'ch', 'pa', 'ju', 'sh', 'ya'];

const isUzbek = (language) => (language || '').startsWith('uz');
const mondayFirst = (date) => (date.getDay() + 6) % 7; // 0 = Monday

// Today's date and month on the school's own calendar (Tashkent), whatever the computer's clock says.
const tashkentParts = () => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((p) => [p.type, p.value]),
);
export const todayIso = () => { const p = tashkentParts(); return `${p.year}-${p.month}-${p.day}`; };
export const currentMonth = () => todayIso().slice(0, 7);

export const localeOf = (language) => LOCALES[(language || 'en').slice(0, 2)] || 'en-GB';

const toDate = (value) => new Date(value.length === 10 ? `${value}T00:00:00` : value);

// 'YYYY-MM-DD' or a full timestamp, written in the user's language.
export const formatDate = (value, language, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!value) return '—';
  const date = toDate(value);
  if (!isUzbek(language)) return date.toLocaleDateString(localeOf(language), options);

  const month = UZ_MONTHS[date.getMonth()];
  const parts = [];
  if (options.weekday) {
    parts.push(`${(options.weekday === 'long' ? UZ_WEEKDAYS_LONG : UZ_WEEKDAYS_SHORT)[mondayFirst(date)]},`);
  }
  parts.push(`${date.getDate()}-${options.month === 'short' ? month.slice(0, 3) : month}`);
  if (options.year) parts.push(String(date.getFullYear()));
  return parts.join(' ');
};

export const formatDateTime = (value, language) => {
  if (!value) return '—';
  const date = new Date(value);
  const time = date.toLocaleTimeString(localeOf(language), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${formatDate(value, language, { day: 'numeric', month: 'short' })}, ${time}`;
};

// Weekday name for 1 (Monday) .. 7 (Sunday). 1 January 2024 was a Monday.
export const weekdayName = (day, language, style = 'short') => {
  if (isUzbek(language)) return (style === 'long' ? UZ_WEEKDAYS_LONG : UZ_WEEKDAYS_SHORT)[day - 1];
  return new Date(2024, 0, day).toLocaleDateString(localeOf(language), { weekday: style });
};

export const weekdaysText = (days, language) => days.map((d) => weekdayName(d, language)).join(', ');

// The school's own clock: weekday (1 = Monday) and minutes since midnight in Tashkent.
export const tashkentNow = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

export const timeToMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
