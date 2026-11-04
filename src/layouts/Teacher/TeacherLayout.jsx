import React, { useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardCheck,
  LogOut,
  ChevronRight,
  GraduationCap
} from 'lucide-react';

const TeacherLayout = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/teacher', icon: LayoutDashboard },
    { name: 'My Groups', path: '/teacher/groups', icon: Users },
    { name: 'Schedule', path: '/teacher/schedule', icon: Calendar },
    { name: 'Attendance', path: '/teacher/attendance', icon: ClipboardCheck },
  ];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-space-dark text-space-text overflow-hidden">
      <aside className={`transition-all duration-300 bg-space-deep border-r border-space-muted/10 flex flex-col ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between">
          {!isCollapsed && <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Mars Teacher</span>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 hover:bg-space-muted/10 rounded-lg transition-colors">
            <ChevronRight className={`transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center p-3 text-space-muted hover:text-space-text hover:bg-blue-500/10 rounded-xl transition-all group"
            >
              <item.icon size={22} className="min-w-[22px] group-hover:text-blue-400 transition-colors" />
              {!isCollapsed && <span className="ml-4 font-medium">{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-space-muted/10">
          <button onClick={handleLogout} className="flex items-center w-full p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all group">
            <LogOut size={22} className="min-w-[22px]" />
            {!isCollapsed && <span className="ml-4 font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-space-muted/10 bg-space-deep/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-space-text">Teacher Instruction Portal</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-space-dark px-3 py-1.5 rounded-full border border-space-muted/10">
              <GraduationCap size={16} className="text-blue-400" />
              <span className="text-xs font-medium text-space-muted">{user?.fullName}</span>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default TeacherLayout;
