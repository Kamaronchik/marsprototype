// End-to-end check of the coins shop against the real database.
// Run AFTER schema_shop.sql and rpc_shop.sql:  npm run test-shop
// It uses fixed "zz_test_*" accounts, which are blocked again at the end.
// Coin transactions and the audit log are append-only, so their test rows stay in the database.
const crypto = require('crypto');
const supabase = require('../config/supabase');
const db = require('../databaseService');
const emailService = require('../services/emailService');
const { hashCode } = require('../utils/codes');

// Keep the emailed code instead of sending a real email.
const sentCodes = [];
emailService.sendPurchaseCodeEmail = async (email, code) => { sentCodes.push({ email, code }); };

const app = require('../server');

const PRICE = 300;
const EXTRA_PRICE = 50;
const CART_TOTAL = PRICE + 2 * EXTRA_PRICE; // the main cart: 1 reward + 2 extras
const GROUP_NAMES = ['ZZ Test Group', 'ZZ Test Group B'];
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();

let failed = 0;
const check = (name, condition, got) => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
  if (!condition) {
    failed += 1;
    if (got !== undefined) console.log('      got:', JSON.stringify(got));
  }
};

// --- setup helpers ---------------------------------------------------------

const ensureUser = async (key, role) => {
  const username = `zz_test_${key}`;
  const existing = await db.findUserByUsername(username);
  if (existing) return db.updateUserSettings(existing.id, { status: 'active' });
  return db.createUser({
    username,
    full_name: `ZZ Test ${key}`,
    email: `${username}@example.invalid`,
    role,
    status: 'active',
    password_hash: crypto.randomBytes(32).toString('hex'), // not a bcrypt hash: nobody can log in
  });
};

// A real session in the database, so the requests pass the same middleware as the browser.
const openSession = async (user) => {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const deviceToken = crypto.randomBytes(32).toString('hex');
  await db.createSession(sha(sessionToken), user.id, sha(deviceToken), new Date(minutesFromNow(60)));
  return { ...user, cookie: `sessionId=${sessionToken}; deviceId=${deviceToken}` };
};

let baseUrl;
const call = async (method, path, who, body) => {
  const res = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who && { Cookie: who.cookie }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

// --- shortcuts -------------------------------------------------------------

const balanceOf = async (student) => (await call('GET', '/api/wallet', student)).body.balance;
const award = (giver, student, amount) => call('POST', '/api/wallet/award', giver, { studentId: student.id, amount });
const line = (product, quantity = 1) => ({ productId: product.id, quantity });
const buy = (student, items) => call('POST', '/api/shop/purchases', student, { items });
const confirmUrl = (verificationId) => `/api/shop/purchases/${verificationId}/confirm`;
const lastCode = () => sentCodes[sentCodes.length - 1].code;
const wrongCode = () => (lastCode() === '000000' ? '000001' : '000000');

// The email cooldown is one minute: move earlier attempts into the past instead of waiting.
const resetCooldown = (student) => supabase
  .from('purchase_verifications')
  .update({ created_at: minutesFromNow(-2) })
  .eq('student_id', student.id);

// Buys a cart through the API, the way the browser does it. Returns the confirm answer.
const buyAndConfirm = async (student, items) => {
  await resetCooldown(student);
  const started = await buy(student, items);
  return call('POST', confirmUrl(started.body.verificationId), student, { code: lastCode() });
};

// An attempt created directly in the database, to test the SQL function without the email step.
const startAttempt = async (student, items, code) => {
  const { data } = await supabase
    .from('purchase_verifications')
    .insert({ student_id: student.id, items, code_hash: hashCode(code), expires_at: minutesFromNow(5) })
    .select()
    .single();
  return data;
};

const confirmRpc = async (student, attempt, code) => {
  const { data } = await supabase.rpc('confirm_purchase', {
    p_verification_id: attempt.id,
    p_student_id: student.id,
    p_code_hash: hashCode(code),
  });
  return data;
};

const createProduct = async (admin, fields) => {
  const { body } = await call('POST', '/api/admin/shop/products', admin, { description: 'Test product', ...fields });
  return body.product;
};

// --- test groups -----------------------------------------------------------

const testAccess = async ({ admin, teacher, studentA }) => {
  console.log('\nAccess control');
  check('no session -> 401', (await call('GET', '/api/shop/products')).status === 401);
  check('teacher cannot open admin orders -> 403', (await call('GET', '/api/admin/shop/orders', teacher)).status === 403);
  check('student cannot open admin products -> 403', (await call('GET', '/api/admin/shop/products', studentA)).status === 403);
  check('student cannot award coins -> 403', (await award(studentA, studentA, 10)).status === 403);
  check('admin has no wallet page -> 403', (await call('GET', '/api/wallet', admin)).status === 403);
  check('teacher cannot cancel a student order -> 403', (await call('POST', `/api/shop/orders/${crypto.randomUUID()}/cancel`, teacher)).status === 403);
};

const testTeacherPool = async ({ admin, teacher, teacherB, studentA, studentB }) => {
  console.log('\nAdmin gives coins to teachers');
  const grant = (who, to, amount) => call('POST', '/api/wallet/grant', who, { teacherId: to.id, amount });
  const poolOf = async (who) => (await call('GET', '/api/wallet/pool', who)).body.balance;

  check('teacher cannot grant coins -> 403', (await grant(teacher, teacher, 10)).status === 403);
  check('student cannot see a pool -> 403', (await call('GET', '/api/wallet/pool', studentA)).status === 403);
  check('grant of 0 -> 400', (await grant(admin, teacher, 0)).status === 400);
  check('grant to a student -> TEACHER_NOT_FOUND', (await grant(admin, studentA, 10)).body.code === 'TEACHER_NOT_FOUND');

  const before = await poolOf(teacher);
  const granted = await grant(admin, teacher, 100);
  check('admin tops up the pool', granted.status === 200 && granted.body.balance === before + 100, granted.body);
  check('teacher sees the new pool', (await poolOf(teacher)) === before + 100);
  const listed = (await call('GET', '/api/wallet/teachers', admin)).body.teachers;
  check('admin sees every teacher with the pool', listed.some((t) => t.id === teacher.id && t.balance === before + 100));
  check('a teacher without coins cannot give any', (await award(teacherB, studentB, 1)).body.code === 'INSUFFICIENT_POOL');
};

const testTeacherAwards = async ({ teacher, studentA, studentB }) => {
  console.log('\nTeacher awards (50 coins per student per month)');
  const poolOf = async () => (await call('GET', '/api/wallet/pool', teacher)).body.balance;
  const poolBefore = await poolOf();
  let given = 0;

  check('student outside own group -> 403', (await award(teacher, studentB, 1)).body.code === 'NOT_YOUR_STUDENT');
  check('amount 0 -> 400', (await award(teacher, studentA, 0)).status === 400);
  check('amount 1.5 -> 400', (await award(teacher, studentA, 1.5)).status === 400);

  // Earlier runs may have used part of the limit, so read what is left.
  const first = await award(teacher, studentA, 1);
  if (first.status === 200) given += 1;
  const { remaining } = first.body;
  const over = await award(teacher, studentA, remaining + 1);
  check('more than the limit -> LIMIT_EXCEEDED', over.status === 400 && over.body.code === 'LIMIT_EXCEEDED', over.body);
  if (remaining > 0) {
    const rest = await award(teacher, studentA, remaining);
    given += remaining;
    check('the rest of the limit is allowed', rest.status === 200 && rest.body.remaining === 0, rest.body);
    check('one more coin -> LIMIT_EXCEEDED', (await award(teacher, studentA, 1)).body.code === 'LIMIT_EXCEEDED');
  }
  check('awarded coins came out of the teacher pool', (await poolOf()) === poolBefore - given, { poolBefore, given });
};

const testPurchaseFlow = async ({ admin, studentA, studentB }, ctx) => {
  console.log('\nCart and purchase with email code');
  const product = await createProduct(admin, { name: 'ZZ Test Reward', price: PRICE });
  const extra = await createProduct(admin, { name: 'ZZ Test Extra', price: EXTRA_PRICE });
  const unavailable = await createProduct(admin, { name: 'ZZ Test Hidden', price: PRICE, isAvailable: false });
  const tooExpensive = await createProduct(admin, { name: 'ZZ Test Expensive', price: (await balanceOf(studentB)) + 1 });
  ctx.products.push(product, extra, unavailable, tooExpensive);

  const catalog = (await call('GET', '/api/shop/products', studentA)).body.products;
  check('catalog shows the product with its price', catalog.some((p) => p.id === product.id && p.price === PRICE));
  check('unavailable product is listed as unavailable', catalog.some((p) => p.id === unavailable.id && !p.isAvailable));

  await award(admin, studentA, 1000);
  await resetCooldown(studentA);
  await resetCooldown(studentB);
  check('empty cart -> 400', (await buy(studentA, [])).status === 400);
  check('0 pieces -> 400', (await buy(studentA, [line(product, 0)])).status === 400);
  check('same product twice in one cart -> INVALID_ITEMS', (await buy(studentA, [line(product), line(product)])).body.code === 'INVALID_ITEMS');
  check('cart with an unavailable product is refused', (await buy(studentA, [line(product), line(unavailable)])).body.code === 'PRODUCT_UNAVAILABLE');
  check('not enough coins -> no code is sent', (await buy(studentB, [line(tooExpensive)])).body.code === 'INSUFFICIENT_COINS' && sentCodes.length === 0);

  const before = await balanceOf(studentA);
  const cart = [line(product), line(extra, 2)];
  const started = await buy(studentA, cart);
  check('checkout starts, total counted by the server, code emailed', started.status === 201 && started.body.total === CART_TOTAL && sentCodes.length === 1 && sentCodes[0].email === studentA.email, started.body);
  check('second code right away -> 429', (await buy(studentA, cart)).status === 429);

  const url = confirmUrl(started.body.verificationId);
  const wrong = await call('POST', url, studentA, { code: wrongCode() });
  check('wrong code -> INVALID_CODE', wrong.body.code === 'INVALID_CODE', wrong.body);
  check('code must be 6 digits -> 400', (await call('POST', url, studentA, { code: 'abc' })).status === 400);
  check('another student cannot confirm it', (await call('POST', url, studentB, { code: lastCode() })).status === 404);
  check('nothing was taken so far', (await balanceOf(studentA)) === before);

  const done = await call('POST', url, studentA, { code: lastCode() });
  check(`right code -> one order, ${CART_TOTAL} coins taken`, done.status === 201 && done.body.balance === before - CART_TOTAL, done.body);
  const again = await call('POST', url, studentA, { code: lastCode() });
  check('same request again -> same order, nothing taken twice', again.status === 200 && again.body.orderId === done.body.orderId && (await balanceOf(studentA)) === before - CART_TOTAL, again.body);

  ctx.orderId = done.body.orderId;
  ctx.product = product;
};

const testOrderLists = async ({ admin, studentA, studentB }, ctx) => {
  console.log('\nOrder lists');
  const own = (await call('GET', '/api/shop/orders', studentA)).body.orders;
  const mine = own.find((o) => o.id === ctx.orderId);
  check('student sees own Pending order with both products', mine?.status === 'Pending' && mine.total === CART_TOTAL && mine.items.length === 2, mine);
  check('items keep name, price and pieces', mine?.items.some((i) => i.productName === 'ZZ Test Extra' && i.unitPrice === EXTRA_PRICE && i.quantity === 2));
  const others = (await call('GET', '/api/shop/orders', studentB)).body.orders;
  check('another student does not see it', !others.some((o) => o.id === ctx.orderId));

  const all = (await call('GET', '/api/admin/shop/orders?status=Pending', admin)).body.orders;
  const seen = all.find((o) => o.id === ctx.orderId);
  check('admin sees who bought what and for how much', seen?.studentEmail === studentA.email && seen.total === CART_TOTAL && seen.items.length === 2, seen);
  check('admin filter by status works', all.every((o) => o.status === 'Pending'));

  const spent = (await call('GET', '/api/wallet/transactions', studentA)).body.transactions;
  check('ledger has one Spend row for the whole order', spent.filter((t) => t.orderId === ctx.orderId && t.type === 'Spend' && t.amount === -CART_TOTAL).length === 1);
};

const testDelivery = async ({ admin, studentA }, ctx) => {
  console.log('\nDelivery');
  const url = `/api/admin/shop/orders/${ctx.orderId}`;
  check('student cannot confirm delivery -> 403', (await call('POST', `${url}/deliver`, studentA)).status === 403);
  check('admin confirms delivery', (await call('POST', `${url}/deliver`, admin)).status === 200);
  check('second confirmation -> ORDER_NOT_PENDING', (await call('POST', `${url}/deliver`, admin)).body.code === 'ORDER_NOT_PENDING');
  check('admin cannot cancel a completed order', (await call('POST', `${url}/cancel`, admin)).status === 409);
  check('student cannot cancel a completed order', (await call('POST', `/api/shop/orders/${ctx.orderId}/cancel`, studentA)).status === 409);

  const { data } = await supabase.from('orders').select('status, completed_at, completed_by').eq('id', ctx.orderId).single();
  check('time and admin id are saved', data.status === 'Completed' && !!data.completed_at && data.completed_by === admin.id, data);
  const own = (await call('GET', '/api/shop/orders', studentA)).body.orders;
  check('student sees Completed', own.some((o) => o.id === ctx.orderId && o.status === 'Completed'));
};

const testCancel = async ({ admin, studentA, studentB }, ctx) => {
  console.log('\nCancel and refund');
  const ledgerOf = async (student) => (await call('GET', '/api/wallet/transactions', student)).body.transactions;

  // 1. The student cancels their own order.
  const before = await balanceOf(studentA);
  const first = await buyAndConfirm(studentA, [line(ctx.product)]);
  check('order is paid', first.status === 201 && first.body.balance === before - PRICE, first.body);

  const url = `/api/shop/orders/${first.body.orderId}/cancel`;
  check('another student cannot cancel it -> 404', (await call('POST', url, studentB)).status === 404);
  check('the owner cancels it', (await call('POST', url, studentA)).status === 200);
  check('coins are back', (await balanceOf(studentA)) === before);
  check('ledger has the Refund row', (await ledgerOf(studentA)).some((t) => t.orderId === first.body.orderId && t.type === 'Refund' && t.amount === PRICE));
  check('cancelling twice -> ORDER_NOT_PENDING', (await call('POST', url, studentA)).body.code === 'ORDER_NOT_PENDING');
  check('student sees it as Cancelled', (await call('GET', '/api/shop/orders', studentA)).body.orders.some((o) => o.id === first.body.orderId && o.status === 'Cancelled'));

  // 2. The admin cancels a student's order.
  const second = await buyAndConfirm(studentA, [line(ctx.product)]);
  const adminUrl = `/api/admin/shop/orders/${second.body.orderId}/cancel`;
  check('admin cancels any Pending order', (await call('POST', adminUrl, admin)).status === 200);
  check('coins are back again', (await balanceOf(studentA)) === before);
  const { data } = await supabase.from('orders').select('status, cancelled_by').eq('id', second.body.orderId).single();
  check('who cancelled is saved', data.status === 'Cancelled' && data.cancelled_by === admin.id, data);
};

const testCodeRules = async ({ studentA }, ctx) => {
  console.log('\nCode rules (SQL function)');
  const items = [line(ctx.product)];
  const expired = await startAttempt(studentA, items, '111111');
  await supabase.from('purchase_verifications').update({ expires_at: minutesFromNow(-1) }).eq('id', expired.id);
  check('expired code -> CODE_EXPIRED', (await confirmRpc(studentA, expired, '111111')).error === 'CODE_EXPIRED');

  const guessed = await startAttempt(studentA, items, '222222');
  const results = [];
  for (let i = 0; i < 5; i += 1) results.push(await confirmRpc(studentA, guessed, '000000'));
  check('4 wrong codes -> INVALID_CODE', results.slice(0, 4).every((r) => r.error === 'INVALID_CODE'));
  check('5th wrong code -> TOO_MANY_ATTEMPTS', results[4].error === 'TOO_MANY_ATTEMPTS');
  check('right code after that is refused', (await confirmRpc(studentA, guessed, '222222')).success === false);
};

const testParallel = async ({ admin, studentB }, ctx) => {
  console.log('\nParallel requests');
  await award(admin, studentB, 100);
  const balance = await balanceOf(studentB);
  const product = await createProduct(admin, { name: 'ZZ Test Race', price: balance });
  ctx.products.push(product);
  const items = [line(product)];

  // Two different codes, but coins for only one purchase.
  const [first, second] = [await startAttempt(studentB, items, '333333'), await startAttempt(studentB, items, '333333')];
  const results = await Promise.all([confirmRpc(studentB, first, '333333'), confirmRpc(studentB, second, '333333')]);
  check('one balance cannot pay twice', results.filter((r) => r.success).length === 1 && results.some((r) => r.error === 'INSUFFICIENT_COINS'), results);
  check('balance is exactly 0, not negative', (await balanceOf(studentB)) === 0);

  // The same code sent twice at once.
  await award(admin, studentB, balance);
  const attempt = await startAttempt(studentB, items, '444444');
  const twice = await Promise.all([confirmRpc(studentB, attempt, '444444'), confirmRpc(studentB, attempt, '444444')]);
  const { data: orders } = await supabase.from('orders').select('id').eq('verification_id', attempt.id);
  check('same code twice at once -> one order', twice.every((r) => r.success) && orders.length === 1, twice);
  check('coins taken once', (await balanceOf(studentB)) === 0);
};

const testProducts = async ({ admin, studentA }, ctx) => {
  console.log('\nProducts');
  check('negative price -> 400', (await call('POST', '/api/admin/shop/products', admin, { name: 'ZZ Test Bad', price: -5 })).status === 400);
  check('fractional price -> 400', (await call('POST', '/api/admin/shop/products', admin, { name: 'ZZ Test Bad', price: 1.5 })).status === 400);

  const edited = await call('PATCH', `/api/admin/shop/products/${ctx.product.id}`, admin, { price: 999 });
  const { data: items } = await supabase.from('order_items').select('unit_price, product_name').eq('order_id', ctx.orderId);
  const kept = items.find((i) => i.product_name === 'ZZ Test Reward');
  check('new price does not change an old order', edited.status === 200 && kept?.unit_price === PRICE, items);

  const archived = await call('DELETE', `/api/admin/shop/products/${ctx.product.id}`, admin);
  check('product with orders is archived, not deleted', archived.body.archived === true, archived.body);
  const catalog = (await call('GET', '/api/shop/products', studentA)).body.products;
  check('archived product leaves the catalog', !catalog.some((p) => p.id === ctx.product.id));

  const fresh = await createProduct(admin, { name: 'ZZ Test Empty', price: 10 });
  const removed = await call('DELETE', `/api/admin/shop/products/${fresh.id}`, admin);
  check('product without orders is deleted', removed.body.archived === false, removed.body);
};

const testImageUpload = async ({ admin }) => {
  console.log('\nImage upload (Supabase Storage)');
  const upload = (type, body) => fetch(`${baseUrl}/api/admin/shop/products/image`, {
    method: 'POST',
    headers: { 'Content-Type': type, Cookie: admin.cookie },
    body,
  });
  // 1x1 transparent PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

  const bad = await upload('text/plain', 'hello');
  check('non-image is refused -> 400', bad.status === 400);
  const good = await upload('image/png', png);
  const { imageUrl } = await good.json();
  check('PNG is stored and gets a public link', good.status === 201 && !!imageUrl, imageUrl);
  if (imageUrl) {
    check('the link opens', (await fetch(imageUrl)).status === 200);
    await supabase.storage.from('shop-products').remove([imageUrl.split('/').pop()]);
  }
};

const testLedger = async ({ teacher, studentA, studentB }) => {
  console.log('\nLedger');
  const { error: updateError } = await supabase.from('transactions').update({ amount: 1 }).eq('student_id', studentA.id);
  check('transactions cannot be edited', !!updateError, updateError);
  const { error: deleteError } = await supabase.from('transactions').delete().eq('student_id', studentA.id);
  check('transactions cannot be deleted', !!deleteError, deleteError);

  for (const student of [studentA, studentB]) {
    const { data: rows } = await supabase.from('transactions').select('amount').eq('student_id', student.id);
    const total = rows.reduce((sum, t) => sum + t.amount, 0);
    check(`${student.username}: ledger total equals balance`, total === (await balanceOf(student)), { total });
  }

  const { data: poolRows } = await supabase.from('teacher_transactions').select('amount').eq('teacher_id', teacher.id);
  const poolTotal = poolRows.reduce((sum, t) => sum + t.amount, 0);
  const pool = (await call('GET', '/api/wallet/pool', teacher)).body.balance;
  check('teacher pool: ledger total equals balance', poolTotal === pool, { poolTotal, pool });
};

// --- run -------------------------------------------------------------------

const cleanup = async (users, ctx) => {
  const ids = users.map((u) => u.id);
  await supabase.from('sessions').delete().in('user_id', ids);
  await supabase.from('groups').delete().in('name', GROUP_NAMES);
  await supabase.from('users').update({ status: 'blocked' }).in('id', ids);

  // Products with orders stay (archived); the rest are removed.
  const productIds = ctx.products.map((p) => p.id);
  const { data: used } = await supabase.from('order_items').select('product_id').in('product_id', productIds);
  const usedIds = new Set(used.map((i) => i.product_id));
  await supabase.from('products').update({ is_archived: true, is_available: false }).in('id', [...usedIds]);
  await supabase.from('products').delete().in('id', productIds.filter((id) => !usedIds.has(id)));
};

(async () => {
  const server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const ctx = { products: [] };
  let users = [];

  try {
    const { error: missing } = await supabase.rpc('get_wallet_balance', { p_student_id: crypto.randomUUID() });
    if (missing?.code === 'PGRST202') throw new Error('Run schema_shop.sql and rpc_shop.sql in Supabase first.');

    const raw = {
      admin: await ensureUser('admin', 'Admin'),
      teacher: await ensureUser('teacher', 'Teacher'),
      teacherB: await ensureUser('teacher_b', 'Teacher'), // never receives coins from an admin
      studentA: await ensureUser('student_a', 'Student'),
      studentB: await ensureUser('student_b', 'Student'),
    };
    users = Object.values(raw);

    await supabase.from('groups').delete().in('name', GROUP_NAMES);
    const { data: groups } = await supabase
      .from('groups')
      .insert([
        { name: GROUP_NAMES[0], teacher_id: raw.teacher.id },
        { name: GROUP_NAMES[1], teacher_id: raw.teacherB.id },
      ])
      .select();
    await supabase.from('group_students').insert([
      { group_id: groups.find((g) => g.name === GROUP_NAMES[0]).id, student_id: raw.studentA.id },
      { group_id: groups.find((g) => g.name === GROUP_NAMES[1]).id, student_id: raw.studentB.id },
    ]);

    const people = {
      admin: await openSession(raw.admin),
      teacher: await openSession(raw.teacher),
      teacherB: await openSession(raw.teacherB),
      studentA: await openSession(raw.studentA),
      studentB: await openSession(raw.studentB),
    };

    await testAccess(people);
    await testTeacherPool(people);
    await testTeacherAwards(people);
    await testPurchaseFlow(people, ctx);
    await testOrderLists(people, ctx);
    await testDelivery(people, ctx);
    await testCancel(people, ctx);
    await testCodeRules(people, ctx);
    await testParallel(people, ctx);
    await testProducts(people, ctx);
    await testImageUpload(people);
    await testLedger(people);
  } catch (error) {
    failed += 1;
    console.error('\nTest run stopped:', error.message);
  } finally {
    if (users.length) await cleanup(users, ctx);
    server.close();
    console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
    process.exitCode = failed ? 1 : 0;
  }
})();
