// Test accounts of all 5 roles plus a small fixture (two groups, one mark).
// Run:  npm run seed-test-users
// The accounts are called zz_test_*. Their passwords are random and never printed:
// tests open sessions directly in the database, so nobody can log in with them.
// The accounts are kept "blocked" between test runs.
const crypto = require('crypto');
const db = require('../databaseService');
const supabase = require('../config/supabase');

const ACCOUNTS = [
  ['admin', 'Admin'],
  ['teacher', 'Teacher'],
  ['teacher2', 'Teacher'],
  ['academic', 'AcademicManager'],
  ['financier', 'Financier'],
  ['student', 'Student'],
  ['student2', 'Student'],
  ['victim', 'Student'], // the account whose role the Admin changes in tests
];

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const ensureUser = async (key, role, status) => {
  const username = `zz_test_${key}`;
  const fields = { status, role, payment_status: 'active' };
  const existing = await db.findUserByUsername(username);
  if (existing) return db.updateUserSettings(existing.id, fields);
  return db.createUser({
    username,
    full_name: `ZZ Test ${key}`,
    email: `${username}@example.invalid`,
    password_hash: crypto.randomBytes(32).toString('hex'), // not a bcrypt hash: nobody can log in
    ...fields,
  });
};

const ensureGroup = async (name, teacherId, startTime) => {
  const { data: found } = await supabase.from('groups').select('*').eq('name', name).maybeSingle();
  const fields = { name, teacher_id: teacherId, weekdays: ALL_DAYS, start_time: startTime, status: 'active' };
  if (found) {
    const { data } = await supabase.from('groups').update(fields).eq('id', found.id).select().single();
    return data;
  }
  const { data, error } = await supabase.from('groups').insert(fields).select().single();
  if (error) throw error;
  return data;
};

// status: 'active' for a test run, 'blocked' when the run is over.
const seedTestData = async (status = 'active') => {
  const users = {};
  for (const [key, role] of ACCOUNTS) users[key] = await ensureUser(key, role, status);

  // Group A: teacher 1, students 1 and 2. Group B: teacher 2, student 2.
  const groupA = await ensureGroup('zz_test_group_a', users.teacher.id, '12:00');
  const groupB = await ensureGroup('zz_test_group_b', users.teacher2.id, '14:00');
  await supabase.from('group_students').upsert([
    { group_id: groupA.id, student_id: users.student.id },
    { group_id: groupA.id, student_id: users.student2.id },
    { group_id: groupB.id, student_id: users.student2.id },
  ], { onConflict: 'group_id,student_id', ignoreDuplicates: true });

  // One mark of student 1, given by teacher 1.
  const { data: oldMarks } = await supabase.from('grades').select('id').eq('title', 'zz_test_mark');
  if (oldMarks?.length) await supabase.from('grades').delete().in('id', oldMarks.map((g) => g.id));
  const { data: grade } = await supabase.from('grades').insert({
    student_id: users.student.id, group_id: groupA.id, teacher_id: users.teacher.id,
    kind: 'test', title: 'zz_test_mark', score: 7, max_score: 10,
  }).select().single();

  return { users, groupA, groupB, grade };
};

const blockTestUsers = async () => {
  await supabase.from('users').update({ status: 'blocked' }).like('username', 'zz_test_%');
  await supabase.from('sessions').delete().in('user_id', (await supabase.from('users').select('id').like('username', 'zz_test_%')).data.map((u) => u.id));
  db.clearSessionCache();
};

module.exports = { seedTestData, blockTestUsers };

if (require.main === module) {
  (async () => {
    const { users } = await seedTestData('blocked');
    console.log('Test accounts are ready (blocked until a test run):');
    for (const [key, user] of Object.entries(users)) console.log(`  ${user.role.padEnd(16)} ${user.username} (${key})`);
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
