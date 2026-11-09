import { LayoutDashboard, Users, GraduationCap, Layers, ClipboardCheck, CreditCard, Wallet, Gift, PackageCheck, Coins, Trophy, Settings, History } from 'lucide-react';
import ControlShell from '../../shells/ControlShell';
import { useRoleLook } from '../../lib/useRoleLook';

const sections = [
  { label: 'nav.sectionMain', items: [
    { label: 'nav.overview', path: '/admin', icon: LayoutDashboard },
  ] },
  { label: 'nav.sectionCrew', items: [
    { label: 'nav.people', path: '/admin/users', icon: Users },
    { label: 'nav.students', path: '/admin/students', icon: GraduationCap },
    { label: 'nav.groups', path: '/admin/groups', icon: Layers },
  ] },
  { label: 'nav.sectionOperations', items: [
    { label: 'nav.attendance', path: '/admin/attendance', icon: ClipboardCheck },
    { label: 'nav.battles', path: '/admin/battles', icon: Trophy },
    { label: 'nav.products', path: '/admin/shop', icon: Gift },
    { label: 'nav.orders', path: '/admin/orders', icon: PackageCheck },
  ] },
  { label: 'nav.sectionMoney', items: [
    { label: 'nav.payments', path: '/admin/payments', icon: CreditCard },
    { label: 'nav.salaries', path: '/admin/salaries', icon: Wallet },
    { label: 'nav.debts', path: '/admin/debts', icon: History },
    { label: 'nav.coins', path: '/admin/coins', icon: Coins },
  ] },
  { label: 'nav.sectionSystem', items: [
    { label: 'nav.settings', path: '/admin/settings', icon: Settings },
  ] },
];

const AdminLayout = () => {
  useRoleLook('Admin');
  return <ControlShell sections={sections} />;
};

export default AdminLayout;
