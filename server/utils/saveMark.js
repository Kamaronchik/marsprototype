const supabase = require('../config/supabase');
const { logAction } = require('./audit');
const { notify } = require('./notify');
const { announceAttendance } = require('./telegramAnnounce');
const { chargeLesson } = require('./balance');

const NOTIFY_TYPES = { present: 'attendance.present', late: 'attendance.late', absent: 'attendance.absent' };

// Saves one tick (present), clock (late) or cross (absent) and does everything that follows:
// takes the lesson price, tells the student in the bell and in Telegram, writes the audit log.
// Used by the attendance page and by the "hold a lesson" form, so both behave the same.
// Returns { id } or { error }.
const saveMark = async ({ group, studentId, status, date, actorId, lessonId = null }) => {
  const { data: before } = await supabase
    .from('attendance').select('status').eq('group_id', group.id).eq('student_id', studentId).eq('lesson_date', date).maybeSingle();

  const row = { group_id: group.id, student_id: studentId, lesson_date: date, status, marked_by: actorId };
  if (lessonId) row.lesson_id = lessonId;

  const { data, error } = await supabase
    .from('attendance')
    .upsert(row, { onConflict: 'group_id,student_id,lesson_date' })
    .select('id')
    .single();
  if (error) return { error };

  // The first mark of this lesson takes the lesson price from the student's balance.
  if (!before) {
    await chargeLesson(studentId, data.id, `${group.name} ${date}`, actorId);
  }

  const changed = !before || before.status !== status;
  if (changed) {
    await notify(
      studentId,
      NOTIFY_TYPES[status],
      { groupName: group.name, date },
      { link: '/student/attendance', dedupeKey: `attendance:${group.id}:${studentId}:${date}:${status}` },
    );
    await announceAttendance({ studentId, attendanceId: data.id, status, groupName: group.name, date });
  }
  if (!before) {
    await logAction(actorId, 'attendance.mark', 'user', studentId, { status, date, groupName: group.name });
  } else if (before.status !== status) {
    await logAction(actorId, 'attendance.change', 'user', studentId, { from: before.status, to: status, date, groupName: group.name });
  }

  return { id: data.id };
};

module.exports = { saveMark };
