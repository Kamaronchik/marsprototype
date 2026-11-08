import { LayoutDashboard, Users, GraduationCap, Layers, ClipboardCheck, CreditCard, Wallet, Gift, PackageCheck, Coins, Settings } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { label: 'nav.overview', path: '/admin', icon: LayoutDashboard },
  { label: 'nav.people', path: '/admin/users', icon: Users },
  { label: 'nav.students', path: '/admin/students', icon: GraduationCap },
  { label: 'nav.groups', path: '/admin/groups', icon: Layers },
  { label: 'nav.attendance', path: '/admin/attendance', icon: ClipboardCheck },
  { label: 'nav.payments', path: '/admin/payments', icon: CreditCard },
  { label: 'nav.salaries', path: '/admin/salaries', icon: Wallet },
  { label: 'nav.products', path: '/admin/shop', icon: Gift },
  { label: 'nav.orders', path: '/admin/orders', icon: PackageCheck },
  { label: 'nav.coins', path: '/admin/coins', icon: Coins },
  { label: 'nav.settings', path: '/admin/settings', icon: Settings },
];

const AdminLayout = () => <AppShell sectionLabel="nav.administration" menuItems={menuItems} />;

export default AdminLayout;
