import { LayoutDashboard, CalendarDays, BookOpenText, AlertTriangle, GraduationCap, Users, BookMarked, Briefcase, ScrollText } from 'lucide-react';
import TopNavShell from '../../shells/TopNavShell';
import { useRoleLook } from '../../lib/useRoleLook';

const menuItems = [
  { label: 'nav.overview', path: '/academic', icon: LayoutDashboard },
  { label: 'nav.schedule', path: '/academic/schedule', icon: CalendarDays },
  { label: 'nav.lessons', path: '/academic/lessons', icon: BookOpenText },
  { label: 'nav.atRisk', path: '/academic/students', icon: AlertTriangle },
  { label: 'nav.teachers', path: '/academic/teachers', icon: GraduationCap },
  { label: 'nav.groups', path: '/academic/groups', icon: Users },
  { label: 'nav.subjects', path: '/academic/subjects', icon: BookMarked },
  { label: 'nav.applications', path: '/academic/applications', icon: Briefcase },
  { label: 'nav.audit', path: '/academic/audit', icon: ScrollText },
];

const AcademicManagerLayout = () => {
  useRoleLook('AcademicManager');
  return <TopNavShell menuItems={menuItems} home="/academic" eyebrow="eyebrow.academic" />;
};

export default AcademicManagerLayout;
