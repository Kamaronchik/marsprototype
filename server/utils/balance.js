const supabase = require('../config/supabase');

// One marked lesson costs this many sum.
const LESSON_PRICE = 90000;

const change = async (studentId, amount, kind, attendanceId, note, byId) => {
  const { data, error } = await supabase.rpc('change_balance', {
    p_student_id: studentId,
    p_amount: amount,
    p_kind: kind,
    p_attendance_id: attendanceId,
    p_note: note,
    p_by: byId,
  });
  if (error) throw error;
  return data; // new balance, or null when the lesson was already charged
};

// Takes the lesson price. Safe to call twice for the same record: it is charged once.
const chargeLesson = (studentId, attendanceId, note, byId) =>
  change(studentId, -LESSON_PRICE, 'lesson', attendanceId, note, byId);

const topUp = (studentId, amount, note, byId) => change(studentId, amount, 'topup', null, note, byId);

module.exports = { LESSON_PRICE, chargeLesson, topUp };
