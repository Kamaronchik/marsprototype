import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUsers, createUser, deleteUser, updateUser } from '../../features/users/usersSlice';
import { toast } from 'react-toastify';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';

const roleStyle = {
  Admin: 'bg-ink/10 text-ink',
  Teacher: 'bg-sky-tint text-sky',
  Financier: 'bg-moss-tint text-moss',
  Student: 'bg-mars-tint text-mars-deep',
};

const UserManagement = () => {
  const users = useSelector((state) => state.users.list);
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    email: '',
    role: 'Student',
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'All' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fullName, username, password, email, role } = formData;
    const emailRequired = role !== 'Admin'; // only Admin may have no email
    if (!fullName || !username || (emailRequired && !email) || (!editingUser && !password)) {
      toast.error('All fields are required');
      return;
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Invalid email format');
      return;
    }

    try {
      if (editingUser) {
        const changes = { fullName, username, email, role };
        if (password) changes.password = password; // empty = keep old password
        await dispatch(updateUser({ id: editingUser.id, changes })).unwrap();
        toast.success('User updated successfully');
      } else {
        await dispatch(createUser({ fullName, username, password, email, role })).unwrap();
        toast.success('User created successfully');
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async (user) => {
    const status = user.status === 'active' ? 'blocked' : 'active';
    try {
      await dispatch(updateUser({ id: user.id, changes: { status } })).unwrap();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setFormData({ fullName: '', username: '', password: '', email: '', role: 'Student' });
    setEditingUser(null);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({ fullName: user.fullName, username: user.username, email: user.email || '', role: user.role, password: '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await dispatch(deleteUser(id)).unwrap();
      toast.info('User deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        title="People"
        action={
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn-primary">
            <Plus size={17} /> Add person
          </button>
        }
      >
        Everyone with an account: students, teachers, finance and admins.
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={17} />
          <input
            type="text"
            placeholder="Search by name or username"
            aria-label="Search people"
            className="field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by role"
          className="field w-auto pr-8"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="All">All roles</option>
          <option value="Admin">Admins</option>
          <option value="Teacher">Teachers</option>
          <option value="Student">Students</option>
          <option value="Financier">Finance</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">Person</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Added</th>
              <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-sunken/40">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken font-display text-base font-semibold text-ink-soft">
                      {user.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{user.fullName}</div>
                      <div className="truncate text-xs text-ink-faint">
                        @{user.username}
                        {user.email ? ` · ${user.email}` : ''}
                        {user.email && !user.emailVerified ? ' · not confirmed' : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${roleStyle[user.role] || 'bg-sunken text-ink-soft'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => toggleStatus(user)}
                    title={user.status === 'active' ? 'Click to block' : 'Click to unblock'}
                    className={`inline-flex items-center gap-2 text-sm font-medium ${
                      user.status === 'active' ? 'text-moss' : 'text-brick'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-moss' : 'bg-brick'}`} />
                    {user.status === 'active' ? 'Active' : 'Blocked'}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-sm text-ink-soft">
                  {new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEditModal(user)}
                      aria-label={`Edit ${user.fullName}`}
                      className="rounded-lg p-2 text-ink-faint hover:bg-sunken hover:text-ink"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      aria-label={`Delete ${user.fullName}`}
                      className="rounded-lg p-2 text-ink-faint hover:bg-brick-tint hover:text-brick"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="5" className="px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold text-ink">No one matches that</p>
                  <p className="mt-1 text-sm text-ink-soft">Try a different name, or clear the role filter.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h3 className="font-display text-xl font-semibold text-ink">
                {editingUser ? 'Edit person' : 'Add a person'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-ink-faint hover:bg-sunken hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="field-label">Full name</label>
                  <input id="fullName" name="fullName" value={formData.fullName} onChange={handleInputChange} className="field" />
                </div>
                <div>
                  <label htmlFor="role" className="field-label">Role</label>
                  <select id="role" name="role" value={formData.role} onChange={handleInputChange} className="field">
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Financier">Finance</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="username" className="field-label">Username</label>
                <input id="username" name="username" value={formData.username} onChange={handleInputChange} className="field" />
              </div>
              <div>
                <label htmlFor="password" className="field-label">Password</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="field"
                  placeholder={editingUser ? 'Leave empty to keep the current one' : 'At least 8 characters'}
                />
              </div>
              <div>
                <label htmlFor="email" className="field-label">
                  Email{formData.role === 'Admin' && <span className="font-normal text-ink-faint"> (optional for admins)</span>}
                </label>
                <input id="email" name="email" value={formData.email} onChange={handleInputChange} className="field" placeholder="name@example.com" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-quiet">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Save changes' : 'Add person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UserManagement;
