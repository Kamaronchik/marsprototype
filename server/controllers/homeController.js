const supabase = require('../config/supabase');
const { handleDbError } = require('../utils/apiErrors');
const { nextLaunch } = require('../utils/schedule');
const { xpOf, rankFor } = require('../utils/ranks');
const { buildStats } = require('../utils/attendance');

const LOG_ENTRIES = 5;

// Everything the student's home screen shows, in one answer: rank and XP, readiness (attendance),
// coins, battle numbers, the next launch (the next lesson) and the latest entries of the mission log.
const getStudentHome = async (req, res) => {
  const me = req.user.id;

  const [attendance, battles, memberships, wallet] = await Promise.all([
    supabase
      .from('attendance')
      .select('lesson_date, status, group:groups!attendance_group_id_fkey(name)')
      .eq('student_id', me)
      .order('lesson_date', { ascending: false })
      .limit(1000),
    supabase
      .from('battles')
      .select('creator_id, opponent_id, winner_side')
      .eq('status', 'finished')
      .or(`creator_id.eq.${me},opponent_id.eq.${me}`)
      .limit(1000),
    supabase
      .from('group_students')
      .select('group:groups(id, name, room, weekdays, start_time, status, teacher:users!groups_teacher_id_fkey(full_name))')
      .eq('student_id', me),
    supabase.rpc('get_wallet_balance', { p_student_id: me }),
  ]);
  const failed = [attendance, battles, memberships, wallet].find((r) => r.error);
  if (failed) return handleDbError(failed.error, res);

  const wins = battles.data.filter((b) => (b.creator_id === me ? b.winner_side === 'creator' : b.winner_side === 'opponent')).length;
  const stats = buildStats(attendance.data);
  const crews = memberships.data.map((m) => m.group).filter((g) => g && g.status === 'active');

  res.json({
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
    })),
    log: attendance.data.slice(0, LOG_ENTRIES).map((r) => ({ date: r.lesson_date, status: r.status, groupName: r.group?.name ?? null })),
  });
};

module.exports = { getStudentHome };
