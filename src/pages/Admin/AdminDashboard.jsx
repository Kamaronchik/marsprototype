import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowUpRight } from 'lucide-react';
import { fetchUsers } from '../../features/users/usersSlice';
import PageHeader from '../../components/PageHeader';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const roleDot = {
  Admin: 'bg-ink',
  Teacher: 'bg-sky',
  Financier: 'bg-moss',
  Student: 'bg-mars',
};

const AdminDashboard = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const { user } = useSelector((state) => state.auth);
  const users = useSelector((state) => state.users.list);
  const groups = useSelector((state) => state.groups.list);
  const payments = useSelector((state) => state.payments.list);

  const count = (role) => users.filter((u) => u.role === role).length;
  const revenue = payments.reduce((sum, p) => sum + (p.status === 'Paid' ? Number(p.amount) : 0), 0);
  const blocked = users.filter((u) => u.status === 'blocked').length;
  const firstName = (user?.fullName || user?.username || '').split(' ')[0];

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const stats = [
    { label: 'Students', value: count('Student') },
    { label: 'Teachers', value: count('Teacher') },
    { label: 'Groups', value: groups.length },
    { label: 'Paid so far', value: `$${revenue.toLocaleString('en-US')}` },
  ];

  const newest = [...users]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`}>{today}</PageHeader>

      {/* Numbers: one ruled strip, not six boxes */}
      <dl className="grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-card md:grid-cols-4 md:divide-x">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-6 py-5 ${i < 2 ? 'border-b border-line md:border-b-0' : ''} ${i % 2 === 0 ? 'border-r border-line md:border-r-0' : ''}`}
          >
            <dt className="text-sm text-ink-soft">{s.label}</dt>
            <dd className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">Newest people</h2>
            <Link to="/admin/users" className="text-sm font-medium text-mars hover:text-mars-deep">
              See everyone
            </Link>
          </div>

          <div className="rounded-xl border border-line bg-card">
            {newest.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-ink-soft">
                No one has been added yet. Start on the People page.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {newest.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${roleDot[u.role] || 'bg-ink-faint'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      <span className="font-semibold">{u.fullName}</span>
                      <span className="text-ink-soft"> joined as {u.role.toLowerCase()}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">Jump to</h2>
          <div className="rounded-xl border border-line bg-card">
            <ul className="divide-y divide-line">
              {[
                { to: '/admin/users', title: 'Add or edit people', hint: `${users.length} accounts` },
                { to: '/admin/groups', title: 'Groups', hint: 'Coming soon' },
                { to: '/admin/settings', title: 'Settings', hint: 'Coming soon' },
              ].map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="flex items-center justify-between px-5 py-3.5 hover:bg-sunken/60">
                    <span>
                      <span className="block text-sm font-semibold text-ink">{l.title}</span>
                      <span className="block text-xs text-ink-faint">{l.hint}</span>
                    </span>
                    <ArrowUpRight size={17} className="text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {blocked > 0 && (
            <p className="mt-4 rounded-lg bg-ochre-tint px-4 py-3 text-sm text-ochre">
              {blocked} {blocked === 1 ? 'account is' : 'accounts are'} blocked right now.
            </p>
          )}
        </section>
      </div>
    </>
  );
};

export default AdminDashboard;
