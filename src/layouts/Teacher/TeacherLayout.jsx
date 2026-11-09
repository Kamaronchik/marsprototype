import { LayoutDashboard, Users, ClipboardCheck, Coins } from 'lucide-react';
import TopNavShell from '../../shells/TopNavShell';
import { useRoleLook } from '../../lib/useRoleLook';

const menuItems = [
  { label: 'nav.today', path: '/teacher', icon: LayoutDashboard },
  { label: 'nav.attendance', path: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'nav.myGroups', path: '/teacher/groups', icon: Users },
  { label: 'nav.coins', path: '/teacher/coins', icon: Coins },
];

const TeacherLayout = () => {
  useRoleLook('Teacher');
  return <TopNavShell menuItems={menuItems} />;
};

export default TeacherLayout;
