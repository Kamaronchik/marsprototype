const supabase = require('../config/supabase');
const { nextLaunch } = require('./schedule');
const { xpOf, rankFor } = require('./ranks');
const { buildStats } = require('./attendance');
const { toSubject } = require('./subjects');

const LOG_ENTRIES = 5;

// Everything known about one student: rank and XP, attendance, coins, battle numbers, the next lesson
// and the latest log entries. The home screen and the Telegram assistant both read it from here.
// Returns { error } or { overview }.
const loadStudentOverview = async (studentId) => {
  const [attendance, battles, memberships, wallet] = await Promise.all([
    supabase
      .from('attendance')
      .select('lesson_date, status, group:groups!attendance_group_id_fkey(name)')
      .eq('student_id', studentId)
      .order('lesson_date', { ascending: false })
      .limit(1000),
    supabase
      .from('battles')
      .select('creator_id, opponent_id, winner_side')
      .eq('status', 'finished')
      .or(`creator_id.eq.${studentId},opponent_id.eq.${studentId}`)
      .limit(1000),
    supabase
      .from('group_students')
      .select('group:groups(id, name, room, weekdays, start_time, status, teacher:users!groups_teacher_id_fkey(full_name), subject:subjects(id, name, name_ru, name_uz, name_en))')
      .eq('student_id', studentId),
    supabase.rpc('get_wallet_balance', { p_student_id: studentId }),
  ]);
  const failed = [attendance, battles, memberships, wallet].find((r) => r.error);
  if (failed) return { error: failed.error };

  const wins = battles.data.filter((b) => (b.creator_id === studentId ? b.winner_side === 'creator' : b.winner_side === 'opponent')).length;
  const stats = buildStats(attendance.data);
  const crews = memberships.data.map((m) => m.group).filter((g) => g && g.status === 'active');

  return {
    overview: {
      rank: rankFor(xpOf({ lessonsAttended: stats.present, battlesWon: wins })),
      readiness: stats,
      coins: wallet.data,
      battles: { wins, played: battles.data.length },
      nextLaunch: nextLaunch(crews),
      crews: crews.map((g) => ({
        id: g.id,
        name: g.name,
        room: g.room,
        weekdays: g.weekdays,
        startTime: g.start_time.slice(0, 5),
        teacherName: g.teacher?.full_name ?? null,
        subject: g.subject ? toSubject(g.subject) : null,
      })),
      log: attendance.data.slice(0, LOG_ENTRIES).map((r) => ({ date: r.lesson_date, status: r.status, groupName: r.group?.name ?? null })),
    },
  };
};

module.exports = { loadStudentOverview };
