import { LayoutDashboard, CalendarDays, BookOpenText, AlertTriangle, GraduationCap, Users } from 'lucide-react';
import TopNavShell from '../../shells/TopNavShell';
import { useRoleLook } from '../../lib/useRoleLook';

const menuItems = [
  { label: 'nav.overview', path: '/academic', icon: LayoutDashboard },
  { label: 'nav.schedule', path: '/academic/schedule', icon: CalendarDays },
  { label: 'nav.lessons', path: '/academic/lessons', icon: BookOpenText },
  { label: 'nav.atRisk', path: '/academic/students', icon: AlertTriangle },
  { label: 'nav.teachers', path: '/academic/teachers', icon: GraduationCap },
  { label: 'nav.groups', path: '/academic/groups', icon: Users },
];

const AcademicManagerLayout = () => {
  useRoleLook('AcademicManager');
  return <TopNavShell menuItems={menuItems} home="/academic" eyebrow="eyebrow.academic" />;
};

export default AcademicManagerLayout;
