import { useSelector } from 'react-redux';
import { LayoutDashboard, ScrollText, ShieldAlert, Users, SlidersHorizontal, Eye, UserCog } from 'lucide-react';
import AppShell from '../../shells/AppShell';

const main = { label: 'nav.sectionMain', items: [
  { label: 'nav.overview', path: '/owner', icon: LayoutDashboard },
  { label: 'nav.violations', path: '/owner/violations', icon: ShieldAlert },
] };

const crew = { label: 'nav.sectionCrew', items: [
  { label: 'nav.audit', path: '/owner/journal', icon: ScrollText },
  { label: 'nav.staff', path: '/owner/staff', icon: Users, end: false },
] };

// Only the CEO changes things: accounts, rules and the journal of the CEO's own actions.
const system = { label: 'nav.sectionSystem', items: [
  { label: 'nav.accounts', path: '/owner/accounts', icon: UserCog },
  { label: 'nav.rules', path: '/owner/rules', icon: SlidersHorizontal },
  { label: 'nav.ownerLog', path: '/owner/my-log', icon: Eye },
] };

// The CEO (role Owner) sees everything; the auditor only reads.
const OwnerLayout = () => {
  const role = useSelector((state) => state.auth.user?.role);
  const sections = role === 'Owner' ? [main, crew, system] : [main, crew];
  return <AppShell sections={sections} eyebrow="eyebrow.owner" />;
};

export default OwnerLayout;
