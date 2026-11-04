import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addUser, deleteUser, updateUser, toggleUserStatus } from '../../features/users/usersSlice';
import { toast } from 'react-toastify';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  UserX,
  UserCheck,
  Filter,
  Mail,
  Lock,
  User
} from 'lucide-react';

const UserManagement = () => {
  const users = useSelector((state) => state.users.list);
  const dispatch = useDispatch();
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.username || !formData.password || !formData.email) {
      toast.error('All fields are required');
      return;
    }

    if (users.some(u => u.username === formData.username && u.id !== editingUser?.id)) {
      toast.error('Username already exists');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Invalid email format');
      return;
    }

    if (editingUser) {
      dispatch(updateUser({ id: editingUser.id, updatedData: formData }));
      toast.success('User updated successfully');
    } else {
      dispatch(addUser({
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: 'active',
      }));
      toast.success('User created successfully');
    }
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ fullName: '', username: '', password: '', email: '', role: 'Student' });
    setEditingUser(null);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({ ...user });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      dispatch(deleteUser(id));
      toast.info('User deleted');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-space-text">User Management</h1>
          <p className="text-space-muted">Manage students, teachers, and financiers of the platform</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-space-accent hover:bg-space-accent/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-space-accent/20"
        >
          <Plus size={18} /> Add User
        </button>
      </div>

      <div className="flex flex-wrap gap-4 bg-space-deep p-4 rounded-2xl border border-space-muted/10">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted" size={18} />
          <input
            type="text"
            placeholder="Search by name or username..."
            className="w-full bg-space-dark border border-space-muted/20 rounded-xl pl-10 pr-4 py-2 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-space-muted" />
          <select
            className="bg-space-dark border border-space-muted/20 rounded-xl px-4 py-2 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Teacher">Teacher</option>
            <option value="Student">Student</option>
            <option value="Financier">Financier</option>
          </select>
        </div>
      </div>

      <div className="bg-space-deep rounded-2xl border border-space-muted/10 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-space-dark/50 text-space-muted text-sm font-medium uppercase tracking-wider">
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Created At</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-space-muted/10">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-space-muted/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-space-accent/10 text-space-accent rounded-full flex items-center justify-center font-bold">
                      {user.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-space-text">{user.fullName}</div>
                      <div className="text-xs text-space-muted">{user.username} • {user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    user.role === 'Admin' ? 'bg-purple-500/10 text-purple-400' :
                    user.role === 'Teacher' ? 'bg-blue-500/10 text-blue-400' :
                    user.role === 'Financier' ? 'bg-green-500/10 text-green-400' :
                    'bg-orange-500/10 text-orange-400'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => dispatch(toggleUserStatus(user.id))}
                    className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                      user.status === 'active' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {user.status === 'active' ? <UserCheck size={14} /> : <UserX size={14} />}
                    {user.status === 'active' ? 'Active' : 'Blocked'}
                  </button>
                </td>
                <td className="px-6 py-4 text-sm text-space-muted">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEditModal(user)} className="p-2 text-space-muted hover:text-space-accent transition-colors rounded-lg hover:bg-space-accent/10">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="p-2 text-space-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-space-muted">
                  No users found matching your criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-space-deep border border-space-muted/20 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-space-muted/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-space-text">{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-space-muted hover:text-space-text transition-colors">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-space-muted uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted" />
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full bg-space-dark border border-space-muted/20 rounded-xl pl-10 pr-4 py-2 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-space-muted uppercase tracking-wider">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full bg-space-dark border border-space-muted/20 rounded-xl px-4 py-2 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50"
                  >
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Financier">Financier</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-space-muted uppercase tracking-wider">Username</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted" />
                  <input
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full bg-space-dark border border-space-muted/20 rounded-xl pl-10 pr-4 py-2 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50"
                    placeholder="johndoe123"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-space-muted uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full bg-space-dark border border-space-muted/20 rounded-xl pl-10 pr-4 py-2 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-space-muted uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-space-muted" />
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-dark border border-space-muted/20 rounded-xl pl-10 pr-4 py-2 text-space-text focus:outline-none focus:ring-2 focus:ring-space-accent/50"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-space-muted hover:text-space-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  className="bg-space-accent hover:bg-space-accent/90 text-white px-6 py-2 rounded-lg font-semibold transition-all"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
