// @vitest-environment jsdom
/* global process */
// Every page of every role is drawn on the REAL answers of the server (real database, real middleware),
// to catch a page that crashes, shows an error or calls an API its role may not use.
// Run:  npm run test:ui   (needs the .env of the project; skipped without it)
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import 'dotenv/config';
import { createRequire } from 'node:module';
import request from 'supertest';
import '../i18n/i18n';
import authReducer from '../features/auth/authSlice';
import usersReducer from '../features/users/usersSlice';
import cartReducer from '../features/cart/cartSlice';
import { clearFetchCache } from '../lib/useFetch';
import StudentHomeProvider from '../features/student/StudentHomeProvider';

import AdminDashboard from './Admin/AdminDashboard';
import UserManagement from './Admin/UserManagement';
import AdminGroups from './Admin/Groups';
import AdminAttendance from './Admin/Attendance';
import Settings from './Admin/Settings';
import Telegram from './Admin/Telegram';
import Students from './shared/Students';
import Payments from './shared/Payments';
import Salaries from './shared/Salaries';
import Subjects from './shared/Subjects';
import Expenses from './shared/Expenses';
import Reports from './shared/Reports';
import Applications from './shared/Applications';
import AuditLogs from './shared/AuditLogs';
import FinanceOverview from './shared/FinanceOverview';
import MySchedule from './shared/MySchedule';
import TeacherHome from '../features/teacher/TeacherHome';
import TeacherAttendance from './Teacher/Attendance';
import TeacherCoins from './Teacher/Coins';
import TeacherGrades from './Teacher/Grades';
import TeacherHomework from './Teacher/Homework';
import TeacherLessons from './Teacher/Lessons';
import MyGroups from './Teacher/MyGroups';
import AcademicDashboard from './AcademicManager/Dashboard';
import AcademicSchedule from './AcademicManager/Schedule';
import AcademicLessons from './AcademicManager/Lessons';
import AcademicRisk from './AcademicManager/Students';
import AcademicTeachers from './AcademicManager/Teachers';
import AcademicGroups from './AcademicManager/Groups';
import AcademicRoster from './AcademicManager/Roster';
import StudentHome from '../features/student/StudentHome';
import StudentAttendance from './Student/Attendance';
import StudentCoins from './Student/Coins';
import StudentGrades from './Student/Grades';
import StudentHomework from './Student/Homework';
import StudentProfile from './Student/Profile';
import Purchases from './Student/Purchases';
import Shop from './Student/Shop';
import Tutor from './Student/Tutor';
import BattleArena from './Student/BattleArena';

const require = createRequire(import.meta.url);

// roles: pages by role, as in src/App.jsx
const ROLES = {
  Admin: {
    AdminDashboard, UserManagement, AdminGroups, AdminAttendance, Settings, Telegram, Students, Payments, Salaries,
    Subjects, Expenses, Reports, Applications, AuditLogs,
  },
  Financier: { FinanceOverview, Payments, Salaries, Students, Expenses, Reports, AuditLogs },
  Teacher: { TeacherHome, MySchedule, TeacherLessons, TeacherAttendance, TeacherHomework, TeacherGrades, MyGroups, TeacherCoins },
  AcademicManager: {
    AcademicDashboard, AcademicSchedule, AcademicLessons, AcademicRisk, AcademicTeachers, AcademicGroups, AcademicRoster,
    Subjects, Applications, AuditLogs,
  },
  Student: {
    StudentHome, MySchedule, StudentAttendance, StudentHomework, StudentGrades, Tutor, BattleArena, Shop, StudentCoins,
    Purchases, StudentProfile,
  },
};
const KEY = { Admin: 'admin', Financier: 'financier', Teacher: 'teacher', AcademicManager: 'academic', Student: 'student' };

// jsdom has no scrolling
Element.prototype.scrollIntoView = () => {};

const hasDatabase = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

describe.skipIf(!hasDatabase)('every page of every role, on the real server', () => {
  let app;
  let ctx;
  let teardown;

  beforeAll(async () => {
    ({ app, ctx, teardown } = await (async () => {
      const helpers = await import('../../server/tests/helpers.mjs');
      return { app: helpers.app, ctx: await helpers.setup(), teardown: helpers.teardown };
    })());
    // Without the e-mail service and Telegram nothing leaves the computer: these pages only read.
    require('../../server/services/emailService');
  }, 90000);

  afterAll(async () => { await teardown?.(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); clearFetchCache(); });

  // The browser's fetch is replaced by the real Express app, with the cookie of the role.
  const realFetch = globalThis.fetch;
  const bridge = (cookie, log) => vi.fn(async (url, options = {}) => {
    // The server itself talks to Supabase with fetch: those calls must reach the real network.
    if (/^https?:/.test(String(url))) return realFetch(url, options);
    const method = (options.method || 'GET').toLowerCase();
    let call = request(app)[method](url).set('Cookie', cookie);
    if (options.body && typeof options.body === 'string') call = call.set('Content-Type', 'application/json').send(options.body);
    const res = await call;
    log.push({ status: res.status, url, method, message: res.body?.message });
    return { ok: res.status < 400, status: res.status, json: async () => res.body };
  });

  for (const [role, pages] of Object.entries(ROLES)) {
    describe(role, () => {
      for (const [name, Page] of Object.entries(pages)) {
        it(name, async () => {
          const log = []; // the answers this page got
          vi.stubGlobal('fetch', bridge(ctx.cookies[KEY[role]], log));
          const store = configureStore({
            reducer: { auth: authReducer, users: usersReducer, cart: cartReducer },
            preloadedState: { auth: { user: { id: ctx.users[KEY[role]].id, role, fullName: 'Test', username: 'test' }, isAuthenticated: true, loading: false, error: null, sessionChecked: true } },
          });
          const errors = [];
          const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(String(a[0]).slice(0, 160)));

          render(
            <Provider store={store}>
              <MemoryRouter>
                {role === 'Student' ? <StudentHomeProvider><Page /></StudentHomeProvider> : <Page />}
              </MemoryRouter>
            </Provider>,
          );
          await waitFor(() => expect(document.body.textContent.length, `calls: ${JSON.stringify(log)} html: ${document.body.innerHTML.slice(0, 300)}`).toBeGreaterThan(20), { timeout: 15000 });
          // wait until the page stopped asking
          let seen = -1;
          for (let i = 0; i < 40 && seen !== log.length; i += 1) {
            seen = log.length;
            await new Promise((r) => setTimeout(r, 250));
          }
          spy.mockRestore();

          const bad = log.filter((f) => f.status >= 400).map((f) => `${f.status} ${f.method.toUpperCase()} ${f.url} (${f.message})`);
          expect({ errors, bad, empty: screen.queryAllByRole('heading').length === 0 && document.body.textContent.length < 40 }).toEqual({ errors: [], bad: [], empty: false });
        }, 60000);
      }
    });
  }
});
