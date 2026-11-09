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

// The next lesson of a student (or teacher) from this moment, looking a week ahead.
// groups: [{ id, name, room, weekdays, start_time }]. A lesson that is running right now counts as "live".
// Returns null when there is none; minutesUntil is 0 for a live lesson.
const nextLaunch = (groups, now = tashkentNow()) => {
  let best = null;

  for (let ahead = 0; ahead <= 7; ahead += 1) {
    const weekday = ((now.weekday - 1 + ahead) % 7) + 1;

    for (const group of groups) {
      if (!group.weekdays.includes(weekday)) continue;

      const start = toMinutes(group.start_time);
      const live = ahead === 0 && start <= now.minutes && now.minutes < start + LESSON_MINUTES;
      if (ahead === 0 && start + LESSON_MINUTES <= now.minutes) continue; // already over today

      const minutesUntil = live ? 0 : ahead * 24 * 60 + start - now.minutes;
      if (!best || minutesUntil < best.minutesUntil) {
        best = {
          groupId: group.id,
          groupName: group.name,
          room: group.room,
          startTime: toTime(start),
          endTime: toTime(start + LESSON_MINUTES),
          dayOffset: ahead,
          weekday,
          live,
          minutesUntil,
        };
      }
    }
  }
  return best;
};

module.exports = {
  TIMEZONE, DAY_OPEN, DAY_CLOSE, LESSON_MINUTES, BREAK_MINUTES,
  ROOMS, WEEKDAYS, SLOTS, toTime, toMinutes, tashkentNow, nextLaunch,
};
