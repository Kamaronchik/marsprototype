const supabase = require('../config/supabase');
const { LESSON_MINUTES, toMinutes, toTime } = require('./schedule');
const { weekdayOf } = require('./attendance');

const GROUP_COLUMNS = 'id, name, room, teacher_id, weekdays, start_time, created_at, teacher:users!groups_teacher_id_fkey(full_name)';

// Every planned lesson slot of the school: [{ groupId, groupName, teacherId, teacherName, room, weekday, startTime, endTime, scheduleId }].
// The schedule table is the source. A group with no rows there falls back to its own weekdays and start_time,
// so groups made before the schedule table existed still show up.
const loadSlots = async ({ teacherId = null, groupId = null } = {}) => {
  let groupsQuery = supabase.from('groups').select(GROUP_COLUMNS).eq('status', 'active');
  if (teacherId) groupsQuery = groupsQuery.eq('teacher_id', teacherId);
  if (groupId) groupsQuery = groupsQuery.eq('id', groupId);
  const { data: groups, error } = await groupsQuery;
  if (error) throw error;
  if (!groups.length) return [];

  const { data: rows, error: scheduleError } = await supabase
    .from('schedule').select('id, group_id, weekday, start_time, end_time').in('group_id', groups.map((g) => g.id));
  if (scheduleError) throw scheduleError;

  const slots = [];
  for (const group of groups) {
    const own = rows.filter((r) => r.group_id === group.id);
    const base = {
      groupId: group.id, groupName: group.name, teacherId: group.teacher_id,
      teacherName: group.teacher?.full_name ?? null, room: group.room, groupCreated: group.created_at.slice(0, 10),
    };
    if (own.length) {
      for (const r of own) {
        slots.push({ ...base, weekday: r.weekday, startTime: r.start_time.slice(0, 5), endTime: r.end_time.slice(0, 5), scheduleId: r.id });
      }
    } else if (group.start_time) {
      for (const weekday of group.weekdays) {
        const end = toTime(toMinutes(group.start_time) + LESSON_MINUTES);
        slots.push({ ...base, weekday, startTime: group.start_time.slice(0, 5), endTime: end, scheduleId: null });
      }
    }
  }
  return slots.sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
};

// The slots of one calendar day ('YYYY-MM-DD').
const slotsOnDate = async (date, filter) => {
  const weekday = weekdayOf(date);
  return (await loadSlots(filter)).filter((s) => s.weekday === weekday);
};

module.exports = { loadSlots, slotsOnDate };
