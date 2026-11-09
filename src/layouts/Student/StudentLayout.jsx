import { LayoutDashboard, UserCircle, ClipboardCheck, Gift, Coins, Receipt, Swords } from 'lucide-react';
import { useDesign } from '../../lib/useDesign';
import { useRoleLook } from '../../lib/useRoleLook';
import StudentHomeProvider from '../../features/student/StudentHomeProvider';
import DockShell from '../../shells/DockShell';
import RailShell from '../../shells/RailShell';
import ExplorerShell from '../../shells/ExplorerShell';

const menuItems = [
  { label: 'nav.home', path: '/student', icon: LayoutDashboard },
  { label: 'nav.attendance', path: '/student/attendance', icon: ClipboardCheck },
  { label: 'nav.battle', path: '/student/battle', icon: Swords, end: false },
  { label: 'nav.shop', path: '/student/shop', icon: Gift },
  { label: 'nav.coins', path: '/student/coins', icon: Coins },
  { label: 'nav.purchases', path: '/student/purchases', icon: Receipt },
  { label: 'nav.profile', path: '/student/profile', icon: UserCircle },
];

// Three designs of the same student area: the cockpit (dock), the base (rail), the console (explorer).
const SHELLS = { cockpit: DockShell, base: RailShell, console: ExplorerShell };

const StudentLayout = () => {
  useRoleLook('Student');
  const Shell = SHELLS[useDesign()];

  return (
    <StudentHomeProvider>
      <Shell menuItems={menuItems} />
    </StudentHomeProvider>
  );
};

export default StudentLayout;
