// The audit system: the rules logic (no database needed) and who may open the owner's panel.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { as, setup, teardown, hasDatabase } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { levelFor, minutesSinceStart } = require('../utils/violations');
const { checkLevels } = require('../controllers/ownerController');
const { canSee } = require('../utils/auditAreas');

const LEVELS = [
  { afterMinutes: 15, to: ['Teacher'] },
  { afterMinutes: 45, to: ['AcademicManager'] },
  { afterMinutes: 1440, to: ['Owner'] },
];

describe('rule ATT_LATE: who is told and when', () => {
  it('tells nobody before the first threshold', () => {
    expect(levelFor(LEVELS, 14)).toBe(-1);
  });

  it('tells the teacher after 15 minutes, the academic manager after 45, the owner after a day', () => {
    expect(levelFor(LEVELS, 15)).toBe(0);
    expect(levelFor(LEVELS, 44)).toBe(0);
    expect(levelFor(LEVELS, 45)).toBe(1);
    expect(levelFor(LEVELS, 1440)).toBe(2);
  });

  it('counts the minutes from the start of the lesson, also for a lesson of yesterday', () => {
    const now = { date: '2026-11-15', minutes: 10 * 60 };
    expect(minutesSinceStart('2026-11-15', '09:00', now)).toBe(60);
    expect(minutesSinceStart('2026-11-14', '09:00', now)).toBe(60 + 1440);
  });
});

describe('the chain of a rule is checked before it is saved', () => {
  it('accepts a good chain', () => {
    expect(checkLevels(LEVELS)).toBeNull();
  });

  it('refuses an empty chain, a chain without people, unknown roles and time that does not grow', () => {
    expect(checkLevels([])).not.toBeNull();
    expect(checkLevels([{ afterMinutes: 10, to: [] }])).not.toBeNull();
    expect(checkLevels([{ afterMinutes: 10, to: ['Student'] }])).not.toBeNull();
    expect(checkLevels([{ afterMinutes: 30, to: ['Owner'] }, { afterMinutes: 30, to: ['Owner'] }])).not.toBeNull();
    expect(checkLevels([{ afterMinutes: -1, to: ['Owner'] }])).not.toBeNull();
  });
});

describe('the Admin is checked by the Owner', () => {
  it('does not see database triggers, rules, violations or what the owner did', () => {
    ['db.attendance.update', 'rule.update', 'violation.open', 'owner.view'].forEach((action) => {
      expect(canSee('Admin', action)).toBe(false);
      expect(canSee('Owner', action)).toBe(true);
    });
  });

  it('still sees the ordinary journal', () => {
    expect(canSee('Admin', 'group.create')).toBe(true);
  });
});

describe.skipIf(!hasDatabase)('the owner panel is closed to every other role', () => {
  let ctx;
  beforeAll(async () => { ctx = await setup(); });
  afterAll(async () => { await teardown(); });

  const PATHS = ['/api/owner/overview', '/api/owner/log', '/api/owner/violations', '/api/owner/staff', '/api/owner/rules'];

  it('asks for a session', async () => {
    for (const path of PATHS) expect((await as(null).get(path)).status).toBe(401);
  });

  it('refuses the Admin and the other staff', async () => {
    for (const role of ['admin', 'academic', 'teacher', 'financier', 'student']) {
      for (const path of PATHS) expect((await as(ctx.cookies[role]).get(path)).status).toBe(403);
    }
  });

  it('does not let anybody but the Owner change a rule or close a violation', async () => {
    const admin = as(ctx.cookies.admin);
    expect((await admin.put('/api/owner/rules/ATT_LATE').send({ enabled: false, severity: 'low', levels: LEVELS })).status).toBe(403);
    expect((await admin.post('/api/owner/violations/00000000-0000-4000-8000-000000000000/close').send({ outcome: 'dismissed', comment: 'test' })).status).toBe(403);
  });

  it('keeps the timer endpoint closed without the secret', async () => {
    expect([401, 503]).toContain((await as(null).get('/api/cron/rules')).status);
  });
});
