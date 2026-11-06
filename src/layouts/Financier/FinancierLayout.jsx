import { LayoutDashboard, CreditCard, History, Users } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { name: 'Overview', path: '/financier', icon: LayoutDashboard },
  { name: 'Payments', path: '/financier/payments', icon: CreditCard },
  { name: 'Debts', path: '/financier/debts', icon: History },
  { name: 'Students', path: '/financier/students', icon: Users },
];

const FinancierLayout = () => <AppShell sectionLabel="Finance" menuItems={menuItems} />;

export default FinancierLayout;
