import { LayoutDashboard, Users, ClipboardCheck, Coins, BookOpenCheck, Award, BookOpenText, CalendarDays } from 'lucide-react';
import AppShell from '../../shells/AppShell';

const menuItems = [
  { label: 'nav.today', path: '/teacher', icon: LayoutDashboard },
  { label: 'nav.mySchedule', path: '/teacher/schedule', icon: CalendarDays },
  { label: 'nav.lessons', path: '/teacher/lessons', icon: BookOpenText },
  { label: 'nav.attendance', path: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'nav.homework', path: '/teacher/homework', icon: BookOpenCheck },
  { label: 'nav.grades', path: '/teacher/grades', icon: Award },
  { label: 'nav.myGroups', path: '/teacher/groups', icon: Users },
  { label: 'nav.coins', path: '/teacher/coins', icon: Coins },
];

const TeacherLayout = () => <AppShell menuItems={menuItems} eyebrow="eyebrow.teacher" />;

export default TeacherLayout;
