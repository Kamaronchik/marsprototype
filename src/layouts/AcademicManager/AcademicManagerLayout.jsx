import { LayoutDashboard, CalendarDays, BookOpenText, AlertTriangle, GraduationCap, Users, BookMarked, ListChecks, Briefcase, ScrollText } from 'lucide-react';
import AppShell from '../../shells/AppShell';

const menuItems = [
  { label: 'nav.overview', path: '/academic', icon: LayoutDashboard },
  { label: 'nav.schedule', path: '/academic/schedule', icon: CalendarDays },
  { label: 'nav.lessons', path: '/academic/lessons', icon: BookOpenText },
  { label: 'nav.atRisk', path: '/academic/students', icon: AlertTriangle },
  { label: 'nav.teachers', path: '/academic/teachers', icon: GraduationCap },
  { label: 'nav.groups', path: '/academic/groups', icon: Users },
  { label: 'nav.students', path: '/academic/roster', icon: ListChecks },
  { label: 'nav.subjects', path: '/academic/subjects', icon: BookMarked },
  { label: 'nav.applications', path: '/academic/applications', icon: Briefcase },
  { label: 'nav.audit', path: '/academic/audit', icon: ScrollText },
];

const AcademicManagerLayout = () => <AppShell menuItems={menuItems} eyebrow="eyebrow.academic" />;

export default AcademicManagerLayout;
