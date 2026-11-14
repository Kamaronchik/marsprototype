import { lazy, Suspense } from 'react';
import { LayoutDashboard, UserCircle, ClipboardCheck, Gift, Swords, BookOpenCheck, Award, Bot, CalendarDays } from 'lucide-react';
import { useDesign } from '../../lib/useDesign';
import { useRoleLook } from '../../lib/useRoleLook';
import StudentHomeProvider from '../../features/student/StudentHomeProvider';
import PageSkeleton from '../../components/PageSkeleton';

// Three designs of the same student area: the cockpit (dock), the base (rail), the console (explorer).
// Only the shell of the chosen design is downloaded.
const DockShell = lazy(() => import('../../shells/DockShell'));
const RailShell = lazy(() => import('../../shells/RailShell'));
const ExplorerShell = lazy(() => import('../../shells/ExplorerShell'));
const SHELLS = { cockpit: DockShell, base: RailShell, console: ExplorerShell };

// Coins and purchases are reached from the Shop page, so the menu stays short.
const menuItems = [
  { label: 'nav.home', path: '/student', icon: LayoutDashboard },
  { label: 'nav.homework', path: '/student/homework', icon: BookOpenCheck },
  { label: 'nav.tutor', path: '/student/tutor', icon: Bot },
  { label: 'nav.grades', path: '/student/grades', icon: Award },
  { label: 'nav.mySchedule', path: '/student/schedule', icon: CalendarDays },
  { label: 'nav.attendance', path: '/student/attendance', icon: ClipboardCheck },
  { label: 'nav.battle', path: '/student/battle', icon: Swords, end: false },
  { label: 'nav.shop', path: '/student/shop', icon: Gift },
  { label: 'nav.profile', path: '/student/profile', icon: UserCircle },
];

const StudentLayout = () => {
  useRoleLook('Student');
  const Shell = SHELLS[useDesign()];

  return (
    <StudentHomeProvider>
      <Suspense fallback={<PageSkeleton />}>
        <Shell menuItems={menuItems} />
      </Suspense>
    </StudentHomeProvider>
  );
};

export default StudentLayout;
