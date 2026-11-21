// A repeated purchase request must not take the coins twice.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { as, supabase, hashCode, minutesFromNow, setup, teardown, hasDatabase } from './helpers.mjs';

const PRICE = 120;
const START = 1000;

describe.skipIf(!hasDatabase)('shop: no double charge', () => {
  let ctx;
  let product;

  const balance = async () => (await as(ctx.cookies.student).get('/api/wallet')).body.balance;
  const attempt = async (code, items) => {
    const { data } = await supabase.from('purchase_verifications')
      .insert({ student_id: ctx.users.student.id, items, code_hash: hashCode(code), expires_at: minutesFromNow(5) })
      .select().single();
    return data;
  };
  const oneItem = () => [{ productId: product.id, quantity: 1 }];

  beforeAll(async () => {
    ctx = await setup();
    await supabase.from('wallets').upsert({ student_id: ctx.users.student.id, balance: START });
    const { data } = await supabase.from('products')
      .insert({ name: 'zz_test_product', description: 'test', price: PRICE, is_available: true, is_archived: false })
      .select().single();
    product = data;
  });

  afterAll(async () => {
    await supabase.from('products').update({ is_available: false, is_archived: true }).eq('id', product.id);
    await teardown();
  });

  it('confirming the same request twice takes the coins once and makes one order', async () => {
    const started = await attempt('424242', oneItem());
    const url = `/api/shop/purchases/${started.id}/confirm`;

    const first = await as(ctx.cookies.student).post(url).send({ code: '424242' });
    expect(first.status).toBe(201);
    const second = await as(ctx.cookies.student).post(url).send({ code: '424242' });
    expect([200, 409]).toContain(second.status);

    expect(await balance()).toBe(START - PRICE);
    const { data: orders } = await supabase.from('orders').select('id').eq('verification_id', started.id);
    expect(orders).toHaveLength(1);
  });

  it('three requests at the same moment still take the coins once', async () => {
    const before = await balance();
    const started = await attempt('515151', oneItem());
    const url = `/api/shop/purchases/${started.id}/confirm`;

    const results = await Promise.all([1, 2, 3].map(() => as(ctx.cookies.student).post(url).send({ code: '515151' })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);

    expect(await balance()).toBe(before - PRICE);
    const { data: orders } = await supabase.from('orders').select('id').eq('verification_id', started.id);
    expect(orders).toHaveLength(1);
  });

  it('another student cannot confirm this request', async () => {
    const before = await balance();
    const started = await attempt('626262', oneItem());
    const res = await as(ctx.cookies.student2).post(`/api/shop/purchases/${started.id}/confirm`).send({ code: '626262' });
    expect(res.status).not.toBe(201);
    expect(await balance()).toBe(before);
  });

  it('a wrong code takes nothing', async () => {
    const before = await balance();
    const started = await attempt('737373', oneItem());
    const res = await as(ctx.cookies.student).post(`/api/shop/purchases/${started.id}/confirm`).send({ code: '000000' });
    expect(res.status).toBe(400);
    expect(await balance()).toBe(before);
  });
});
