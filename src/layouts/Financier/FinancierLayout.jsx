import { LayoutDashboard, CreditCard, Wallet, History, GraduationCap } from 'lucide-react';
import LedgerShell from '../../shells/LedgerShell';
import { useRoleLook } from '../../lib/useRoleLook';

const menuItems = [
  { label: 'nav.overview', path: '/financier', icon: LayoutDashboard },
  { label: 'nav.payments', path: '/financier/payments', icon: CreditCard },
  { label: 'nav.salaries', path: '/financier/salaries', icon: Wallet },
  { label: 'nav.debts', path: '/financier/debts', icon: History },
  { label: 'nav.students', path: '/financier/students', icon: GraduationCap },
];

const FinancierLayout = () => {
  useRoleLook('Financier');
  return <LedgerShell menuItems={menuItems} />;
};

export default FinancierLayout;
