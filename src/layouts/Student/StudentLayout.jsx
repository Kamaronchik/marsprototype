import { LayoutDashboard, UserCircle, ClipboardCheck } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { label: 'nav.home', path: '/student', icon: LayoutDashboard },
  { label: 'nav.attendance', path: '/student/attendance', icon: ClipboardCheck },
  { label: 'nav.profile', path: '/student/profile', icon: UserCircle },
];

const StudentLayout = () => <AppShell sectionLabel="nav.learning" menuItems={menuItems} />;

export default StudentLayout;
