// The school day, in one place. The frontend gets these lists from GET /api/groups/options.
const TIMEZONE = 'Asia/Tashkent';
const DAY_OPEN = 9 * 60;        // 09:00, first lesson starts, teachers may mark attendance
const DAY_CLOSE = 22 * 60;      // 22:00, nothing starts or is marked after this
const LESSON_MINUTES = 90;
const BREAK_MINUTES = 70;       // 1 hour 10 minutes between lessons

const ROOMS = ['A', 'B', 'C'].flatMap((row) => [1, 2, 3, 4].map((n) => `${row}${n}`));
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]; // 1 = Monday

const pad = (n) => String(n).padStart(2, '0');
const toTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// Lesson start times: 09:00, 11:40, 14:20, 17:00, 19:40 (the last must end before closing).
const SLOTS = [];
for (let start = DAY_OPEN; start + LESSON_MINUTES <= DAY_CLOSE; start += LESSON_MINUTES + BREAK_MINUTES) {
  SLOTS.push(toTime(start));
}

// Current date, minutes since midnight and weekday (1-7) in Tashkent.
const tashkentNow = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday,
  };
};

module.exports = {
  TIMEZONE, DAY_OPEN, DAY_CLOSE, LESSON_MINUTES, BREAK_MINUTES,
  ROOMS, WEEKDAYS, SLOTS, toTime, toMinutes, tashkentNow,
};
