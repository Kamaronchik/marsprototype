import React, { useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../../features/auth/authSlice';
import {
  LayoutDashboard,
  UserCircle,
  BookOpen,
  Calendar,
  LogOut,
  ChevronRight,
  Rocket
} from 'lucide-react';

const StudentLayout = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { name: 'My Dashboard', path: '/student', icon: LayoutDashboard },
    { name: 'My Profile', path: '/student/profile', icon: UserCircle },
    { name: 'My Courses', path: '/student/courses', icon: BookOpen },
    { name: 'Schedule', path: '/student/schedule', icon: Calendar },
  ];

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-space-dark text-space-text overflow-hidden">
      <aside className={`transition-all duration-300 bg-space-deep border-r border-space-muted/10 flex flex-col ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between">
          {!isCollapsed && <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Mars Student</span>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 hover:bg-space-muted/10 rounded-lg transition-colors">
            <ChevronRight className={`transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center p-3 text-space-muted hover:text-space-text hover:bg-orange-500/10 rounded-xl transition-all group"
            >
              <item.icon size={22} className="min-w-[22px] group-hover:text-orange-400 transition-colors" />
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
          <h2 className="text-lg font-semibold text-space-text">Student Learning Portal</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-space-dark px-3 py-1.5 rounded-full border border-space-muted/10">
              <Rocket size={16} className="text-orange-400" />
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

export default StudentLayout;
