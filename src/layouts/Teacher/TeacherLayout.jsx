import { LayoutDashboard, Users, Calendar, ClipboardCheck } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { name: 'Today', path: '/teacher', icon: LayoutDashboard },
  { name: 'My groups', path: '/teacher/groups', icon: Users },
  { name: 'Schedule', path: '/teacher/schedule', icon: Calendar },
  { name: 'Attendance', path: '/teacher/attendance', icon: ClipboardCheck },
];

const TeacherLayout = () => <AppShell sectionLabel="Teaching" menuItems={menuItems} />;

export default TeacherLayout;
