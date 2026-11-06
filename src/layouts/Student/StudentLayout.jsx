import { LayoutDashboard, UserCircle, BookOpen, Calendar } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { name: 'Home', path: '/student', icon: LayoutDashboard },
  { name: 'Courses', path: '/student/courses', icon: BookOpen },
  { name: 'Schedule', path: '/student/schedule', icon: Calendar },
  { name: 'Profile', path: '/student/profile', icon: UserCircle },
];

const StudentLayout = () => <AppShell sectionLabel="Learning" menuItems={menuItems} />;

export default StudentLayout;
