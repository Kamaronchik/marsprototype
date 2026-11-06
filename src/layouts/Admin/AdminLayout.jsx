import { LayoutDashboard, Users, Settings, Layers } from 'lucide-react';
import AppShell from '../../components/AppShell';

const menuItems = [
  { name: 'Overview', path: '/admin', icon: LayoutDashboard },
  { name: 'People', path: '/admin/users', icon: Users },
  { name: 'Groups', path: '/admin/groups', icon: Layers },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

const AdminLayout = () => <AppShell sectionLabel="Administration" menuItems={menuItems} />;

export default AdminLayout;
