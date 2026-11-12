const supabase = require('../config/supabase');
const { sayTo, defaults, logMessage } = require('./telegramBot');

// Tells a student in Telegram how the teacher marked them. Does nothing when the student has not
// connected Telegram. Never throws: a failed message must not break the teacher's marking.
//   present: "thanks for coming"; any open question about this lesson is cancelled.
//   absent: the bot asks why, and the answer goes to the admin's Telegram tab.
// overrides replaces the real sender in tests.
const announceAttendance = async ({ studentId, attendanceId, status, groupName, date }, overrides = {}) => {
  try {
    const deps = { ...defaults, ...overrides };
    const { data: link } = await supabase
      .from('telegram_links').select('user_id, chat_id, language').eq('user_id', studentId).maybeSingle();
    if (!link) return;

    if (status === 'present') {
      await supabase.from('telegram_absences').update({ status: 'cancelled' }).eq('attendance_id', attendanceId).eq('status', 'asked');
      await sayTo(deps, link, 'cameNotice', { group: groupName, date });
      return;
    }

    // One question per lesson. Marking absent again after an answer must not ask twice.
    const { data: existing } = await supabase.from('telegram_absences').select('id, status').eq('attendance_id', attendanceId).maybeSingle();
    if (existing?.status === 'answered' || existing?.status === 'asked') return;

    const row = { attendance_id: attendanceId, student_id: studentId, status: 'asked', reason: null, asked_at: new Date().toISOString(), answered_at: null };
    await supabase.from('telegram_absences').upsert(row, { onConflict: 'attendance_id' });
    await supabase.from('attendance').update({ reason_requested_at: row.asked_at }).eq('id', attendanceId);
    await sayTo(deps, link, 'absentQuestion', { group: groupName, date }, { kind: 'absence_question' });
  } catch (error) {
    console.error('Telegram announcement error:', error.message);
  }
};

// Sends one ready text (balance top up, freeze, unfreeze) to a student. Does nothing when the student
// has not connected Telegram. Never throws: a failed message must not break the admin's action.
const announceToStudent = async (studentId, key, values = {}, overrides = {}) => {
  try {
    const deps = { ...defaults, ...overrides };
    const { data: link } = await supabase
      .from('telegram_links').select('user_id, chat_id, language').eq('user_id', studentId).maybeSingle();
    if (!link) return;
    await sayTo(deps, link, key, values);
  } catch (error) {
    console.error('Telegram announcement error:', error.message);
  }
};

// The weekly question: "rate this lesson" with the buttons 1-5. Does nothing when the student has no Telegram.
// A pressed button comes back as "rate:<lessonId>:<score>" (see telegramBot.js).
const sendRatingPrompt = async (studentId, lesson, overrides = {}) => {
  try {
    const deps = { ...defaults, ...overrides };
    const { data: link } = await supabase
      .from('telegram_links').select('user_id, chat_id, language').eq('user_id', studentId).maybeSingle();
    if (!link) return;
    const buttons = [1, 2, 3, 4, 5].map((n) => ({ text: String(n), data: `rate:${lesson.id}:${n}` }));
    await sayTo(deps, link, 'ratePrompt', { topic: lesson.topic, group: lesson.groupName, date: lesson.date }, { options: { inline: [buttons] } });
  } catch (error) {
    console.error('Telegram rating error:', error.message);
  }
};

// A text written by a person (the academic manager). Does nothing when the student has no Telegram.
// Returns true when the message went out.
const announceText = async (studentId, text, overrides = {}) => {
  try {
    const deps = { ...defaults, ...overrides };
    const { data: link } = await supabase
      .from('telegram_links').select('user_id, chat_id, language').eq('user_id', studentId).maybeSingle();
    if (!link) return false;
    await deps.send(link.chat_id, text);
    await logMessage(studentId, 'out', 'text', text);
    return true;
  } catch (error) {
    console.error('Telegram announcement error:', error.message);
    return false;
  }
};

module.exports = { announceAttendance, announceToStudent, sendRatingPrompt, announceText };
