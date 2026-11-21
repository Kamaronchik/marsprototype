// @vitest-environment jsdom
/* global process */
// The real scenario on the real server: the auditor gives a teacher a penalty through the form,
// the CEO sees it waiting, the auditor takes it back with a reason.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import 'dotenv/config';
import request from 'supertest';
import '../../i18n/i18n';
import i18n from '../../i18n/i18n';
import authReducer from '../../features/auth/authSlice';
import { clearFetchCache } from '../../lib/useFetch';
import Penalties from './Penalties';

const hasDatabase = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
const COMMENT = 'ZZ test: phone during the lesson';

describe.skipIf(!hasDatabase)('penalties page, on the real server', () => {
  let helpers;
  let ctx;

  beforeAll(async () => {
    helpers = await import('../../../server/tests/helpers.mjs');
    ctx = await helpers.setup();
    await i18n.changeLanguage('ru');
  }, 90000);

  afterAll(async () => {
    const { supabase } = helpers;
    await supabase.from('violations').delete().eq('details->>comment', COMMENT);
    await supabase.from('notifications').delete().like('data->>teacherName', 'ZZ Test%');
    await supabase.from('notifications').delete().in('user_id', Object.values(ctx.users).map((u) => u.id)).like('type', 'penalty.%');
    await helpers.teardown();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); clearFetchCache(); });

  // The browser's fetch goes to the real Express app with the cookie of the role.
  const realFetch = globalThis.fetch;
  const openAs = (key, role) => {
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (/^https?:/.test(String(url))) return realFetch(url, options);
      let call = request(helpers.app)[(options.method || 'GET').toLowerCase()](url).set('Cookie', ctx.cookies[key]);
      if (typeof options.body === 'string') call = call.set('Content-Type', 'application/json').send(options.body);
      const res = await call;
      return { ok: res.status < 400, status: res.status, json: async () => res.body };
    }));
    const store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: { auth: { user: { id: ctx.users[key].id, role, fullName: 'Test', username: 'test' }, isAuthenticated: true, loading: false, error: null, sessionChecked: true } },
    });
    render(<Provider store={store}><MemoryRouter><Penalties /></MemoryRouter></Provider>);
  };

  // The card in the list (the same text is also in the form until it is sent).
  const findCard = async () => {
    const text = await screen.findByText(COMMENT, { selector: 'li p' }, { timeout: 15000 });
    return text.closest('li');
  };

  it('the auditor gives a penalty, the CEO sees it, the auditor takes it back with a reason', async () => {
    // 1. The auditor: every teacher is in the list, the form sends the penalty.
    openAs('auditor', 'Auditor');
    const teacher = await screen.findByRole('radio', { name: 'ZZ Test teacher' }, { timeout: 15000 });
    expect(screen.getByRole('radio', { name: 'ZZ Test teacher2' })).toBeTruthy();
    // Nobody is chosen until a click.
    expect(screen.getAllByRole('radio').some((r) => r.getAttribute('aria-checked') === 'true')).toBe(false);

    fireEvent.click(teacher);
    expect(teacher.getAttribute('aria-checked')).toBe('true');
    await screen.findByRole('option', { name: /3\.2 · Телефон во время урока/ });
    fireEvent.change(screen.getByLabelText('Правило'), { target: { value: 'MARS_3_2' } });
    expect(screen.getByText(/Объяснительная на имя руководителя/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Что случилось'), { target: { value: COMMENT } });
    fireEvent.click(screen.getByRole('button', { name: 'Выдать наказание' }));

    const card = await findCard();
    expect(within(card).getByText('Ждёт решения CEO')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Подтвердить' })).toBeNull(); // only the CEO confirms
    cleanup(); clearFetchCache();

    // 2. The CEO sees it waiting and can confirm or cancel it.
    openAs('owner', 'Owner');
    const ceoCard = await findCard();
    expect(within(ceoCard).getByRole('button', { name: 'Подтвердить' })).toBeTruthy();
    cleanup(); clearFetchCache();

    // 3. The auditor takes it back: the button waits for a reason.
    openAs('auditor', 'Auditor');
    const again = await findCard();
    const remove = within(again).getByRole('button', { name: 'Снять наказание' });
    expect(remove.disabled).toBe(true);
    fireEvent.change(within(again).getByLabelText('Причина (обязательно)'), { target: { value: 'Wrong person on the video' } });
    expect(remove.disabled).toBe(false);
    fireEvent.click(remove);

    await waitFor(async () => {
      const { data } = await helpers.supabase.from('violations').select('status, resolution_comment').eq('details->>comment', COMMENT).single();
      expect(data).toEqual({ status: 'dismissed', resolution_comment: 'Wrong person on the video' });
      // The teacher is told last, so the request is over when this is there.
      const { data: told } = await helpers.supabase.from('notifications').select('id').eq('user_id', ctx.users.teacher.id).eq('type', 'penalty.removed');
      expect(told.length).toBeGreaterThan(0);
    }, { timeout: 15000 });
  }, 90000);
});
