// Checks the Telegram assistant end to end. Telegram and Gemini are replaced by fakes:
// nothing is sent to a real chat and no model is called. Run:  npm run test-telegram
const {
  supabase, check, markFailed, ensureUser, openSession, startServer, call, finish,
} = require('./testKit');
const { handleUpdate, defaults } = require('../utils/telegramBot');
const { announceAttendance } = require('../utils/telegramAnnounce');
const { hashCode } = require('../utils/codes');
const { say } = require('../utils/botTexts');

const GROUP = 'ZZ Telegram Group';
const CHAT = 700000000 + Math.floor(Math.random() * 1000000);
const OTHER_CHAT = CHAT + 1;
const DATE = '2026-11-09';

// Everything the bot "sends" is kept here instead.
let sent = [];
const fakes = {
  send: async (chatId, text, options) => { sent.push({ chatId, text, options }); },
  answerCallback: async () => {},
  ask: async (args) => { fakes.asked = args; return 'AI says hello'; },
};
const last = () => sent[sent.length - 1];
const say_ = (chatId, text) => handleUpdate({ message: { chat: { id: chatId, type: 'private' }, text } }, fakes);
const press = (chatId, data) => handleUpdate({ callback_query: { id: 'cb', data, message: { chat: { id: chatId } } } }, fakes);

const testLinking = async (who) => {
  console.log('\nConnecting a student');
  const status0 = await call('GET', '/api/telegram/status', who.student);
  check('a new student is not connected', status0.status === 200 && status0.body.linked === false, status0.body);

  const link = await call('POST', '/api/telegram/link', who.student);
  const token = link.body.url?.split('?start=')[1];
  check('the site makes a one-time link to the bot', link.status === 201 && link.body.url.startsWith('https://t.me/') && token?.length === 48, link.body);
  const { data: stored } = await supabase.from('telegram_link_tokens').select('token_hash').eq('user_id', who.student.id);
  check('only the hash of the token is stored', stored.length === 1 && stored[0].token_hash === hashCode(token) && stored[0].token_hash !== token);
  check('a teacher cannot make a link', (await call('POST', '/api/telegram/link', who.teacher)).status === 403);

  await handleUpdate({ message: { chat: { id: CHAT, type: 'private' }, text: '/start wrongtoken' } }, fakes);
  check('a wrong token is refused', last().text.includes(say('en', 'tokenInvalid')), last());

  sent = [];
  await handleUpdate({ message: { chat: { id: CHAT, type: 'private' }, text: `/start ${token}` } }, fakes);
  check('the right token connects the chat', sent[0].text.includes(who.student.full_name), sent);
  check('the language is asked first, with three buttons', sent[1].options.inline[0].length === 3, sent[1]);
  const { data: row } = await supabase.from('telegram_links').select('chat_id, language').eq('user_id', who.student.id).single();
  check('the link is saved', Number(row.chat_id) === CHAT, row);

  await handleUpdate({ message: { chat: { id: OTHER_CHAT, type: 'private' }, text: `/start ${token}` } }, fakes);
  check('the same token cannot be used twice', last().text.includes(say('en', 'tokenInvalid')), last());

  const status1 = await call('GET', '/api/telegram/status', who.student);
  check('the status now says connected', status1.body.linked === true, status1.body);

  sent = [];
  await press(CHAT, 'lang:uz');
  check('choosing a language saves it and greets in that language', last().text === say('uz', 'welcome', { name: 'ZZ' }) && last().options.keyboard.length === 2, last());
  await press(CHAT, 'lang:xx');
  const { data: after } = await supabase.from('telegram_links').select('language').eq('user_id', who.student.id).single();
  check('an unknown language is ignored', after.language === 'uz', after);

  sent = [];
  await say_(OTHER_CHAT, 'hello');
  check('a stranger is told to connect on the site', last().text.includes('Mars Space') && sent.length === 1, sent);
  sent = [];
  await handleUpdate({ message: { chat: { id: CHAT, type: 'group' }, text: 'hello' } }, fakes);
  check('group chats are ignored', sent.length === 0, sent);
};

const testButtons = async (who) => {
  console.log('\nButtons: coins, attendance, next lesson');
  const { data: balance } = await supabase.rpc('get_wallet_balance', { p_student_id: who.student.id });
  sent = [];
  await say_(CHAT, say('uz', 'btnCoins'));
  check('the coins button shows the balance', last().text === say('uz', 'coins', { coins: balance }), last());
  await say_(CHAT, say('uz', 'btnAttendance'));
  check('attendance with no marks says so', last().text === say('uz', 'attendanceNone'), last());
  await say_(CHAT, say('uz', 'btnNext'));
  check('the next lesson button answers', last().text.includes('ZZ Telegram Group') || last().text === say('uz', 'nextNone'), last());
  sent = [];
  await handleUpdate({ message: { chat: { id: CHAT, type: 'private' }, photo: [{}] } }, fakes);
  check('a message without text gets a polite answer', last().text === say('uz', 'textOnly'), last());
};

const testAbsence = async (who, groupId) => {
  console.log('\nAbsent: the bot asks why, the answer reaches the admin');
  const { data: record } = await supabase.from('attendance').insert({
    group_id: groupId, student_id: who.student.id, lesson_date: DATE, status: 'absent', marked_by: who.teacher.id,
  }).select('id').single();

  sent = [];
  await announceAttendance({ studentId: who.student.id, attendanceId: record.id, status: 'absent', groupName: GROUP, date: DATE }, fakes);
  check('the student is asked for the reason', last()?.text === say('uz', 'absentQuestion', { group: GROUP, date: DATE }), last());
  await announceAttendance({ studentId: who.student.id, attendanceId: record.id, status: 'absent', groupName: GROUP, date: DATE }, fakes);
  check('marking again does not ask twice', sent.length === 1, sent);

  sent = [];
  await say_(CHAT, 'I was ill, sorry');
  check('the first free message is taken as the reason', last().text === say('uz', 'reasonSaved'), last());
  const { data: saved } = await supabase.from('attendance').select('absence_reason, reason_requested_at, reason_received_at').eq('id', record.id).single();
  check('the reason is stored on the attendance record', saved.absence_reason === 'I was ill, sorry' && saved.reason_requested_at && saved.reason_received_at, saved);
  const { data: absence } = await supabase.from('telegram_absences').select('status, reason').eq('attendance_id', record.id).single();
  check('the question is closed', absence.status === 'answered' && absence.reason === 'I was ill, sorry', absence);
  const { data: bell } = await supabase.from('notifications').select('id').eq('type', 'telegram.reason').like('data->>studentName', 'ZZ Test%');
  check('the admins get a notification', bell.length >= 1, bell);

  await announceAttendance({ studentId: who.student.id, attendanceId: record.id, status: 'absent', groupName: GROUP, date: DATE }, fakes);
  check('an answered question is not asked again', sent.length === 1, sent);

  // Present after absent: an open question is cancelled.
  await supabase.from('telegram_absences').update({ status: 'asked', reason: null }).eq('attendance_id', record.id);
  sent = [];
  await announceAttendance({ studentId: who.student.id, attendanceId: record.id, status: 'present', groupName: GROUP, date: DATE }, fakes);
  const { data: cancelled } = await supabase.from('telegram_absences').select('status').eq('attendance_id', record.id).single();
  check('marked present: the student is thanked and the question cancelled', last().text === say('uz', 'cameNotice', { group: GROUP, date: DATE }) && cancelled.status === 'cancelled', { last: last(), cancelled });
};

const testAi = async (who) => {
  console.log('\nFree questions go to the model');
  sent = [];
  await say_(CHAT, 'What is a closure?');
  check('the answer of the model is sent', last().text === 'AI says hello', last());
  check('the model is told the language', fakes.asked.system.includes('Uzbek'), fakes.asked.system.slice(0, 200));
  check('the model knows this student', fakes.asked.system.includes('ZZ Test student'));
  check('coins are not given to the model', !/coin/i.test(fakes.asked.system));
  check('the model gets the question', fakes.asked.text === 'What is a closure?');

  const { data: log } = await supabase.from('telegram_messages').select('direction, kind').eq('user_id', who.student.id).eq('kind', 'ai');
  check('the answer is in the log', log.length === 1 && log[0].direction === 'out', log);

  fakes.ask = async () => { throw new Error('model is down'); };
  sent = [];
  await say_(CHAT, 'Another question');
  check('when the model fails the student gets an apology', last().text === say('uz', 'aiFailed'), last());
  fakes.ask = async (args) => { fakes.asked = args; return 'AI says hello'; };

  await supabase.from('telegram_messages').insert(Array.from({ length: 30 }, () => ({ user_id: who.student.id, direction: 'out', kind: 'ai', body: 'x' })));
  sent = [];
  await say_(CHAT, 'One more');
  check('after the daily limit the model is not asked', last().text === say('uz', 'aiLimit'), last());
};

const testWebhookAndAdmin = async (who) => {
  console.log('\nWebhook and the admin tab');
  const hook = (headers) => fetch(`${require('./testKit').serverUrl()}/api/telegram/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ message: { chat: { id: 1, type: 'group' }, text: 'x' } }),
  });
  check('a call without the secret is refused', (await hook({})).status === 401);
  check('a call with a wrong secret is refused', (await hook({ 'x-telegram-bot-api-secret-token': 'nope' })).status === 401);
  check('a call with the right secret is accepted', (await hook({ 'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET })).status === 200);

  const hidden = await call('GET', '/api/admin/telegram', who.admin);
  check('a cancelled question is not shown to the admin', !hidden.body.absences.some((a) => a.studentId === who.student.id), hidden.body.absences);
  await supabase.from('telegram_absences').update({ status: 'answered', reason: 'I was ill, sorry' }).eq('student_id', who.student.id);
  const overview = await call('GET', '/api/admin/telegram', who.admin);
  check('the admin sees who is connected', overview.status === 200 && overview.body.chats.some((c) => c.userId === who.student.id), overview.body);
  check('the admin sees the absence answers', overview.body.absences.some((a) => a.studentId === who.student.id && a.groupName === GROUP));
  const chat = await call('GET', `/api/admin/telegram/chats/${who.student.id}`, who.admin);
  check('the admin reads the conversation', chat.status === 200 && chat.body.messages.some((m) => m.kind === 'absence_reason'), chat.body.messages?.length);
  check('a student cannot open the admin tab', (await call('GET', '/api/admin/telegram', who.student)).status === 403);
  check('a teacher cannot open the admin tab', (await call('GET', '/api/admin/telegram', who.teacher)).status === 403);
  check('a bad id is refused', (await call('GET', '/api/admin/telegram/chats/nope', who.admin)).status === 400);

  const sentBefore = sent.length;
  defaults.send = async () => { sent.push('unlink'); };
  const gone = await call('DELETE', '/api/telegram/link', who.student);
  check('the student disconnects Telegram', gone.status === 200 && gone.body.linked === false && sent.length === sentBefore + 1, gone.body);
  const { data: rows } = await supabase.from('telegram_links').select('user_id').eq('user_id', who.student.id);
  check('the link is gone', rows.length === 0);
};

const cleanup = async (users, groupId) => {
  const ids = users.map((u) => u.id);
  await supabase.from('telegram_messages').delete().in('user_id', ids);
  await supabase.from('telegram_absences').delete().in('student_id', ids);
  await supabase.from('telegram_link_tokens').delete().in('user_id', ids);
  await supabase.from('telegram_links').delete().in('user_id', ids);
  await supabase.from('attendance').delete().in('student_id', ids);
  if (groupId) {
    await supabase.from('group_students').delete().eq('group_id', groupId);
    await supabase.from('groups').delete().eq('id', groupId);
  }
  // Only the notifications this test created: the real admins have their own.
  await supabase.from('notifications').delete().eq('type', 'telegram.reason').like('data->>studentName', 'ZZ Test%');
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('users').update({ status: 'blocked' }).in('id', ids);
};

(async () => {
  const server = startServer();
  let users = [];
  let groupId = null;
  try {
    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      student: await ensureUser('student_a', 'Student'),
    };
    users = Object.values(raw);
    await supabase.from('telegram_links').delete().in('user_id', users.map((u) => u.id));
    await supabase.from('groups').delete().eq('name', GROUP);

    const { data: group } = await supabase.from('groups').insert({
      name: GROUP, teacher_id: raw.teacher.id, room: 'B2', weekdays: [1, 2, 3, 4, 5, 6, 7], start_time: '11:40', monthly_price: 450000,
    }).select('id').single();
    groupId = group.id;
    await supabase.from('group_students').insert({ group_id: groupId, student_id: raw.student.id });

    const who = {};
    for (const [key, user] of Object.entries(raw)) who[key] = await openSession(user);

    await testLinking(who);
    await testButtons(who);
    await testAbsence(who, groupId);
    await testAi(who);
    await testWebhookAndAdmin(who);
  } catch (error) {
    markFailed();
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users, groupId);
    finish(server);
  }
})();
