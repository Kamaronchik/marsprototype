// @vitest-environment jsdom
// The Academic Manager's groups page with an answer shaped like the real server's.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '../../i18n/i18n';
import Groups from './Groups';

const groups = [
  { id: 'g1', name: 'nF-2631', teacherId: 't1', teacherName: 'Teacher One', subjectId: null, subject: null, room: 'A1', weekdays: [1, 3], startTime: '10:00', status: 'active', studentCount: 2 },
  { id: 'g2', name: 'Old group', teacherId: null, teacherName: null, subjectId: null, subject: null, room: null, weekdays: [], startTime: null, status: 'archived', studentCount: 0 },
];
const answers = {
  '/api/groups': { groups },
  '/api/academic/teacher-names': { teachers: [{ id: 't1', fullName: 'Teacher One' }] },
  '/api/subjects': { subjects: [] },
  '/api/groups/g1/students': { students: [{ id: 's1', fullName: 'Student One' }, { id: 's2', fullName: 'Student Two' }] },
};

const fakeServer = () => vi.fn(async (url) => {
  const body = answers[url];
  return { ok: !!body, status: body ? 200 : 404, json: async () => body ?? { message: 'Not found' } };
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Academic Manager: groups', () => {
  it('shows the active groups and their students', async () => {
    vi.stubGlobal('fetch', fakeServer());
    render(<Groups />);

    expect(await screen.findByText('nF-2631')).toBeTruthy();
    expect(screen.queryByText('Old group')).toBeNull(); // archived groups are hidden

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(await screen.findByText('Student One')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Student Two')).toBeTruthy());
  });
});
