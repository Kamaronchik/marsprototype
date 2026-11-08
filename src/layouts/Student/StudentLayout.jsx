import { LayoutDashboard, UserCircle, ClipboardCheck, Gift, Coins, Receipt } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { label: 'nav.home', path: '/student', icon: LayoutDashboard },
  { label: 'nav.attendance', path: '/student/attendance', icon: ClipboardCheck },
  { label: 'nav.shop', path: '/student/shop', icon: Gift },
  { label: 'nav.coins', path: '/student/coins', icon: Coins },
  { label: 'nav.purchases', path: '/student/purchases', icon: Receipt },
  { label: 'nav.profile', path: '/student/profile', icon: UserCircle },
];

const StudentLayout = () => <AppShell sectionLabel="nav.learning" menuItems={menuItems} />;

export default StudentLayout;
