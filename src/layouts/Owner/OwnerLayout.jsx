import { LayoutDashboard, ScrollText, ShieldAlert, Users, SlidersHorizontal, Eye } from 'lucide-react';
import AppShell from '../../shells/AppShell';

const sections = [
  { label: 'nav.sectionMain', items: [
    { label: 'nav.overview', path: '/owner', icon: LayoutDashboard },
    { label: 'nav.violations', path: '/owner/violations', icon: ShieldAlert },
  ] },
  { label: 'nav.sectionCrew', items: [
    { label: 'nav.audit', path: '/owner/journal', icon: ScrollText },
    { label: 'nav.staff', path: '/owner/staff', icon: Users, end: false },
  ] },
  { label: 'nav.sectionSystem', items: [
    { label: 'nav.rules', path: '/owner/rules', icon: SlidersHorizontal },
    { label: 'nav.ownerLog', path: '/owner/my-log', icon: Eye },
  ] },
];

const OwnerLayout = () => <AppShell sections={sections} eyebrow="eyebrow.owner" />;

export default OwnerLayout;
