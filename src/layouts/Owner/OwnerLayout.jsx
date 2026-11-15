import { useSelector } from 'react-redux';
import { LayoutDashboard, ShieldAlert, Users, SlidersHorizontal, UserCog, Banknote, KeyRound } from 'lucide-react';
import AppShell from '../../shells/AppShell';

const main = { label: 'nav.sectionMain', items: [
  { label: 'nav.overview', path: '/owner', icon: LayoutDashboard },
  { label: 'nav.violations', path: '/owner/violations', icon: ShieldAlert },
  { label: 'nav.fines', path: '/owner/fines', icon: Banknote },
] };

const crew = { label: 'nav.sectionCrew', items: [
  { label: 'nav.staff', path: '/owner/staff', icon: Users, end: false },
] };

// Only the CEO changes things: accounts and rules.
const system = { label: 'nav.sectionSystem', items: [
  { label: 'nav.accounts', path: '/owner/accounts', icon: UserCog },
  { label: 'nav.rules', path: '/owner/rules', icon: SlidersHorizontal },
] };

const mine = { label: 'nav.sectionMine', items: [
  { label: 'nav.password', path: '/owner/password', icon: KeyRound },
] };

// The CEO (role Owner) sees everything; the auditor only reads. Both change their own password.
const OwnerLayout = () => {
  const role = useSelector((state) => state.auth.user?.role);
  const sections = role === 'Owner' ? [main, crew, system, mine] : [main, crew, mine];
  return <AppShell sections={sections} eyebrow="eyebrow.owner" />;
};

export default OwnerLayout;
