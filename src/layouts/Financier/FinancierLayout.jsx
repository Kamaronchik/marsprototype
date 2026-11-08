import { LayoutDashboard, CreditCard, Wallet, History, GraduationCap } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { label: 'nav.overview', path: '/financier', icon: LayoutDashboard },
  { label: 'nav.payments', path: '/financier/payments', icon: CreditCard },
  { label: 'nav.salaries', path: '/financier/salaries', icon: Wallet },
  { label: 'nav.debts', path: '/financier/debts', icon: History },
  { label: 'nav.students', path: '/financier/students', icon: GraduationCap },
];

const FinancierLayout = () => <AppShell sectionLabel="nav.finance" menuItems={menuItems} />;

export default FinancierLayout;
