import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUsers, createUser, deleteUser, updateUser } from '../../features/users/usersSlice';
import { toast } from 'react-toastify';
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { useFetch } from '../../lib/useFetch';
import { messageText } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { SkeletonAvatar, SkeletonText } from '../../components/Skeleton';

const roleStyle = {
  Admin: 'bg-ink/10 text-ink',
  Teacher: 'bg-sky-tint text-sky',
  Financier: 'bg-moss-tint text-moss',
  Student: 'bg-mars-tint text-mars-deep',
};

const UserManagement = () => {
  const { t, i18n } = useTranslation();
  const groupsQuery = useFetch('/api/groups');
  const activeGroups = (groupsQuery.data?.groups ?? []).filter((g) => g.status === 'active');
  const users = useSelector((state) => state.users.list);
  const usersLoading = useSelector((state) => state.users.loading);
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
    groupId: '',
  });

  // Filtering the whole roster on every keystroke is the one real cost on this page; useMemo skips
  // it unless the roster, the search text or the role filter actually changed.
  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'All' || user.role === filterRole;
    return matchesSearch && matchesRole;
  }), [users, searchTerm, filterRole]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { fullName, username, password, email, role, groupId } = formData;
    const emailRequired = role !== 'Admin'; // only Admin may have no email
    if (!fullName || !username || (emailRequired && !email) || (!editingUser && !password)) {
      toast.error(t('peoplePage.allRequired'));
      return;
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      toast.error(t('peoplePage.invalidEmail'));
      return;
    }

    try {
      if (editingUser) {
        const changes = { fullName, username, email, role };
        if (password) changes.password = password; // empty = keep old password
        await dispatch(updateUser({ id: editingUser.id, changes })).unwrap();
        toast.success(t('peoplePage.updated'));
      } else {
        await dispatch(createUser({ fullName, username, password, email, role, groupId: role === 'Student' && groupId ? groupId : undefined })).unwrap();
        groupsQuery.reload();
        toast.success(t('peoplePage.created'));
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error(messageText(t, err.message));
    }
  };

  const toggleStatus = async (user) => {
    const status = user.status === 'active' ? 'blocked' : 'active';
    try {
      await dispatch(updateUser({ id: user.id, changes: { status } })).unwrap();
    } catch (err) {
      toast.error(messageText(t, err.message));
    }
  };

  const resetForm = () => {
    setFormData({ fullName: '', username: '', password: '', email: '', role: 'Student', groupId: '' });
    setEditingUser(null);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({ fullName: user.fullName, username: user.username, email: user.email || '', role: user.role, password: '', groupId: '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('peoplePage.confirmDelete'))) return;
    try {
      await dispatch(deleteUser(id)).unwrap();
      toast.info(t('peoplePage.deleted'));
    } catch (err) {
      toast.error(messageText(t, err.message));
    }
  };

  return (
    <>
      <PageHeader
        title={t('peoplePage.title')}
        action={
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn-primary">
            <Plus size={17} /> {t('peoplePage.add')}
          </button>
        }
      >
        {t('peoplePage.subtitle')}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" size={17} />
          <input
            type="text"
            placeholder={t('peoplePage.search')}
            aria-label={t('peoplePage.search')}
            className="field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          aria-label={t('peoplePage.filterRole')}
          className="field w-auto pr-8"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="All">{t('peoplePage.allRoles')}</option>
          {['Admin', 'Teacher', 'Student', 'Financier'].map((role) => (
            <option key={role} value={role}>{t(`rolesPlural.${role}`)}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-sunken/60 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <th className="px-5 py-3">{t('peoplePage.person')}</th>
              <th className="px-5 py-3">{t('peoplePage.role')}</th>
              <th className="px-5 py-3">{t('peoplePage.status')}</th>
              <th className="px-5 py-3">{t('peoplePage.added')}</th>
              <th className="px-5 py-3"><span className="sr-only">{t('common.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {usersLoading && Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><SkeletonAvatar size="2.25rem" /><div className="space-y-2"><SkeletonText width="9rem" /><SkeletonText width="7rem" height="0.7rem" /></div></div></td>
                <td className="px-5 py-3.5"><SkeletonText width="4rem" height="1.4rem" /></td>
                <td className="px-5 py-3.5"><SkeletonText width="4.5rem" /></td>
                <td className="px-5 py-3.5"><SkeletonText width="5rem" /></td>
                <td className="px-5 py-3.5" />
              </tr>
            ))}
            {!usersLoading && filteredUsers.map((user) => (
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
                        {user.email && !user.emailVerified ? ` · ${t('peoplePage.notConfirmed')}` : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${roleStyle[user.role] || 'bg-sunken text-ink-soft'}`}>
                    {t(`roles.${user.role}`)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => toggleStatus(user)}
                    title={user.status === 'active' ? t('peoplePage.clickToBlock') : t('peoplePage.clickToUnblock')}
                    className={`inline-flex items-center gap-2 text-sm font-medium ${
                      user.status === 'active' ? 'text-moss' : 'text-brick'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-moss' : 'bg-brick'}`} />
                    {user.status === 'active' ? t('peoplePage.active') : t('peoplePage.blocked')}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-sm text-ink-soft">
                  {formatDate(user.createdAt, i18n.language)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEditModal(user)}
                      aria-label={t('peoplePage.edit', { name: user.fullName })}
                      className="rounded-lg p-2 text-ink-faint hover:bg-sunken hover:text-ink"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      aria-label={t('peoplePage.remove', { name: user.fullName })}
                      className="rounded-lg p-2 text-ink-faint hover:bg-brick-tint hover:text-brick"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!usersLoading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan="5" className="px-5 py-14 text-center">
                  <p className="font-display text-lg font-semibold text-ink">{t('peoplePage.noMatch')}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t('peoplePage.noMatchHint')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h3 className="font-display text-xl font-semibold text-ink">
                {editingUser ? t('peoplePage.editTitle') : t('peoplePage.addTitle')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label={t('common.close')}
                className="rounded-lg p-1.5 text-ink-faint hover:bg-sunken hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="field-label">{t('peoplePage.fullName')}</label>
                  <input id="fullName" name="fullName" value={formData.fullName} onChange={handleInputChange} className="field" />
                </div>
                <div>
                  <label htmlFor="role" className="field-label">{t('peoplePage.role')}</label>
                  <select id="role" name="role" value={formData.role} onChange={handleInputChange} className="field">
                    {['Student', 'Teacher', 'Financier', 'Admin'].map((role) => (
                      <option key={role} value={role}>{t(`roles.${role}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="username" className="field-label">{t('peoplePage.username')}</label>
                <input id="username" name="username" value={formData.username} onChange={handleInputChange} className="field" />
              </div>
              <div>
                <label htmlFor="password" className="field-label">{t('peoplePage.password')}</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="field"
                  placeholder={editingUser ? t('peoplePage.passwordKeep') : t('peoplePage.passwordNew')}
                />
              </div>
              <div>
                <label htmlFor="email" className="field-label">
                  {t('auth.email')}{formData.role === 'Admin' && <span className="font-normal text-ink-faint"> {t('peoplePage.emailOptional')}</span>}
                </label>
                <input id="email" name="email" value={formData.email} onChange={handleInputChange} className="field" placeholder="name@example.com" />
              </div>

              {formData.role === 'Student' && !editingUser && (
                <div>
                  <label htmlFor="groupId" className="field-label">{t('people.group')}</label>
                  <select id="groupId" name="groupId" value={formData.groupId} onChange={handleInputChange} className="field">
                    <option value="">{t('people.noGroupYet')}</option>
                    {activeGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} · {g.room} · {g.startTime} · {g.teacherName}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-ink-faint">{t('people.groupHint')}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-quiet">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? t('peoplePage.saveChanges') : t('peoplePage.add')}
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
