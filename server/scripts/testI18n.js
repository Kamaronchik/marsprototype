// End-to-end check of the translation editor against the real database.
// Run AFTER 007_battle.sql (it creates the "translations" table):  npm run test-i18n
// The test changes one real text, checks it, and puts the original back.
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');

const KEY = 'common.save';
const PLURAL_KEY = 'groups.studentsCount_other';
const TEXT = 'ZZ Test Save';
const TOUCHED = [['ru', KEY], ['en', PLURAL_KEY]];

const overridesOf = async (lang) => (await call('GET', `/api/i18n/${lang}`)).body.overrides;

const testReading = async () => {
  console.log('\nReading the changed texts');
  for (const lang of ['ru', 'uz', 'en']) {
    check(`anyone can read the changes of ${lang}`, (await call('GET', `/api/i18n/${lang}`)).status === 200);
  }
  check('an unknown language -> 400', (await call('GET', '/api/i18n/de')).status === 400);
};

const testEditing = async ({ admin, teacher, studentA }) => {
  console.log('\nChanging a text');
  const save = (who, body) => call('PUT', '/api/i18n', who, body);

  check('no session -> 401', (await save(undefined, { lang: 'ru', key: KEY, value: TEXT })).status === 401);
  check('a student cannot change texts -> 403', (await save(studentA, { lang: 'ru', key: KEY, value: TEXT })).status === 403);
  check('a teacher cannot change texts -> 403', (await save(teacher, { lang: 'ru', key: KEY, value: TEXT })).status === 403);

  check('an unknown language -> 400', (await save(admin, { lang: 'de', key: KEY, value: TEXT })).status === 400);
  check('a text that does not exist -> 400', (await save(admin, { lang: 'ru', key: 'no.such.key', value: TEXT })).status === 400);
  check('a section is not a text -> 400', (await save(admin, { lang: 'ru', key: 'common', value: TEXT })).status === 400);
  check('an empty text -> 400', (await save(admin, { lang: 'ru', key: KEY, value: '   ' })).status === 400);
  check('a text over 2000 characters -> 400', (await save(admin, { lang: 'ru', key: KEY, value: 'x'.repeat(2001) })).status === 400);
  // This text uses {{count}}: a new text without it must be refused.
  const lost = await save(admin, { lang: 'en', key: PLURAL_KEY, value: 'ZZ Test many students' });
  check('losing a {{count}} placeholder is refused -> 400', lost.status === 400, lost.body);
  const kept = await save(admin, { lang: 'en', key: PLURAL_KEY, value: 'ZZ Test {{count}} pupils' });
  check('keeping the placeholder is fine', kept.status === 200, kept.body);

  const saved = await save(admin, { lang: 'ru', key: KEY, value: `  ${TEXT}  ` });
  check('admin changes a text', saved.status === 200, saved.body);
  check('everyone now reads the new text (trimmed)', (await overridesOf('ru'))[KEY] === TEXT);
  check('other languages are not touched', (await overridesOf('uz'))[KEY] === undefined);

  const again = await save(admin, { lang: 'ru', key: KEY, value: 'ZZ Test Save 2' });
  check('changing it again replaces the text', again.status === 200 && (await overridesOf('ru'))[KEY] === 'ZZ Test Save 2');

  const { data: journal } = await supabase.from('audit_log').select('id').eq('action', 'translation.save').eq('actor_id', admin.id).limit(1);
  check('the change is written to the journal', journal.length === 1);

  check('a student cannot reset -> 403', (await call('DELETE', '/api/i18n', studentA, { lang: 'ru', key: KEY })).status === 403);
  check('admin resets to the original', (await call('DELETE', '/api/i18n', admin, { lang: 'ru', key: KEY })).status === 200);
  check('the original is back', (await overridesOf('ru'))[KEY] === undefined);
  await call('DELETE', '/api/i18n', admin, { lang: 'en', key: PLURAL_KEY });
  check('both test changes are gone', !(await overridesOf('en'))[PLURAL_KEY]?.startsWith('ZZ Test'));
};

// --- run -------------------------------------------------------------------

// The real texts the admin may have changed in these two places are saved first and put back at the end.
const rememberReal = async () => {
  const { data } = await supabase.from('translations').select('lang, key, value').in('key', TOUCHED.map(([, key]) => key));
  return data.filter((row) => TOUCHED.some(([lang, key]) => row.lang === lang && row.key === key));
};

const cleanup = async (users, real) => {
  const ids = users.map((u) => u.id);
  await supabase.from('translations').delete().like('value', 'ZZ Test%');
  if (real.length) await supabase.from('translations').upsert(real, { onConflict: 'lang,key' });
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked', payment_status: 'active' }).in('id', ids);
};

(async () => {
  const server = startServer();
  let users = [];
  let real = [];

  try {
    const { error: missing } = await supabase.from('translations').select('key').limit(1);
    if (missing) throw new Error('Run 007_battle.sql in Supabase first (it creates the translations table).');

    real = await rememberReal();

    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      studentA: await ensureUser('student_a', 'Student'),
    };
    users = Object.values(raw);
    const people = {};
    for (const [key, user] of Object.entries(raw)) people[key] = await openSession(user);

    await testReading();
    await testEditing(people);
  } catch (error) {
    markFailed();
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users, real);
    finish(server);
  }
})();
