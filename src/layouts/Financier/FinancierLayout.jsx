import { LayoutDashboard, CreditCard, Wallet, History, GraduationCap, Receipt, BarChart3, ScrollText } from 'lucide-react';
import AppShell from '../../shells/AppShell';

const menuItems = [
  { label: 'nav.overview', path: '/financier', icon: LayoutDashboard },
  { label: 'nav.payments', path: '/financier/payments', icon: CreditCard },
  { label: 'nav.salaries', path: '/financier/salaries', icon: Wallet },
  { label: 'nav.debts', path: '/financier/debts', icon: History },
  { label: 'nav.students', path: '/financier/students', icon: GraduationCap },
  { label: 'nav.expenses', path: '/financier/expenses', icon: Receipt },
  { label: 'nav.reports', path: '/financier/reports', icon: BarChart3 },
  { label: 'nav.audit', path: '/financier/audit', icon: ScrollText },
];

const FinancierLayout = () => <AppShell menuItems={menuItems} eyebrow="eyebrow.finance" search />;

export default FinancierLayout;
