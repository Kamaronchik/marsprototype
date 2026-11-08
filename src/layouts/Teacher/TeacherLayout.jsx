import { Users, ClipboardCheck, Coins } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { label: 'nav.attendance', path: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'nav.myGroups', path: '/teacher/groups', icon: Users },
  { label: 'nav.coins', path: '/teacher/coins', icon: Coins },
];

const TeacherLayout = () => <AppShell sectionLabel="nav.teaching" menuItems={menuItems} />;

export default TeacherLayout;
