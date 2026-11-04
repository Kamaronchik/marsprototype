import React from 'react';
import { useSelector } from 'react-redux';
import {
  Users,
  UserCheck,
  CreditCard,
  BookOpen,
  TrendingUp,
  Activity
} from 'lucide-react';

const AdminDashboard = () => {
  const users = useSelector((state) => state.users.list);
  const groups = useSelector((state) => state.groups.list);
  const payments = useSelector((state) => state.payments.list);

  const stats = [
    { label: 'Total Students', value: users.filter(u => u.role === 'Student').length, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Total Teachers', value: users.filter(u => u.role === 'Teacher').length, icon: UserCheck, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Total Financiers', value: users.filter(u => u.role === 'Financier').length, icon: CreditCard, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Active Groups', value: groups.length, icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { label: 'Total Revenue', value: `$${payments.reduce((sum, p) => sum + (p.status === 'Paid' ? Number(p.amount) : 0), 0)}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'System Health', value: 'Optimal', icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-space-text">System Overview</h1>
        <p className="text-space-muted">Real-time monitoring of your educational ecosystem</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-space-deep border border-space-muted/10 p-6 rounded-2xl hover:border-space-accent/30 transition-all group">
            <div className="flex items-start justify-between">
              <div className={`${stat.bg} ${stat.color} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                <stat.icon size={24} />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-space-text">{stat.value}</div>
                <div className="text-sm text-space-muted">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-space-deep border border-space-muted/10 p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-space-text mb-4">Recent User Activity</h3>
          <div className="space-y-4">
            {users.slice(-5).reverse().map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-space-dark rounded-xl border border-space-muted/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-space-accent/10 text-space-accent rounded-full flex items-center justify-center text-xs font-bold">
                    {user.fullName.charAt(0)}
                  </div>
                  <span className="text-sm text-space-text">{user.fullName} joined as {user.role}</span>
                </div>
                <span className="text-[10px] text-space-muted">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {users.length === 0 && <div className="text-center py-8 text-space-muted">No activity yet</div>}
          </div>
        </div>

        <div className="bg-space-deep border border-space-muted/10 p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-space-text mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="p-4 bg-space-dark border border-space-muted/10 rounded-xl text-left hover:border-space-accent transition-colors group">
              <div className="text-space-accent mb-2"><Users size={20} /></div>
              <div className="text-sm font-medium text-space-text group-hover:text-space-accent">Manage Users</div>
            </button>
            <button className="p-4 bg-space-dark border border-space-muted/10 rounded-xl text-left hover:border-space-accent transition-colors group">
              <div className="text-space-accent mb-2"><BookOpen size={20} /></div>
              <div className="text-sm font-medium text-space-text group-hover:text-space-accent">Create Group</div>
            </button>
            <button className="p-4 bg-space-dark border border-space-muted/10 rounded-xl text-left hover:border-space-accent transition-colors group">
              <div className="text-space-accent mb-2"><CreditCard size={20} /></div>
              <div className="text-sm font-medium text-space-text group-hover:text-space-accent">Finance Report</div>
            </button>
            <button className="p-4 bg-space-dark border border-space-muted/10 rounded-xl text-left hover:border-space-accent transition-colors group">
              <div className="text-space-accent mb-2"><Activity size={20} /></div>
              <div className="text-sm font-medium text-space-text group-hover:text-space-accent">System Logs</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
