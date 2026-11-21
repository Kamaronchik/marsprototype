import { LayoutDashboard, UserCircle, ClipboardCheck, Gift, Swords, BookOpenCheck, Award, Bot, CalendarDays } from 'lucide-react';
import AppShell from '../../shells/AppShell';
import StudentHomeProvider from '../../features/student/StudentHomeProvider';

// Coins and purchases are reached from the Shop page, so the menu stays short.
const menuItems = [
  { label: 'nav.home', path: '/student', icon: LayoutDashboard },
  { label: 'nav.homework', path: '/student/homework', icon: BookOpenCheck },
  { label: 'nav.tutor', path: '/student/tutor', icon: Bot },
  { label: 'nav.grades', path: '/student/grades', icon: Award },
  { label: 'nav.mySchedule', path: '/student/schedule', icon: CalendarDays },
  { label: 'nav.attendance', path: '/student/attendance', icon: ClipboardCheck },
  { label: 'nav.battle', path: '/student/battle', icon: Swords, end: false },
  { label: 'nav.shop', path: '/student/shop', icon: Gift },
  { label: 'nav.profile', path: '/student/profile', icon: UserCircle },
];

const StudentLayout = () => (
  <StudentHomeProvider>
    <AppShell menuItems={menuItems} eyebrow="eyebrow.student" />
  </StudentHomeProvider>
);

export default StudentLayout;
