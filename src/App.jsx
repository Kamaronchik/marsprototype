import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch } from 'react-redux';
import { restoreSession } from './features/auth/authSlice';
import { store } from './app/store';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from './features/auth/LoginPage';
import DeviceVerificationPage from './pages/auth/DeviceVerificationPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/Admin/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import Groups from './pages/Admin/Groups';
import AdminAttendance from './pages/Admin/Attendance';
import Students from './pages/shared/Students';
import FinanceOverview from './pages/shared/FinanceOverview';
import Payments from './pages/shared/Payments';
import Salaries from './pages/shared/Salaries';
import TeacherAttendance from './pages/Teacher/Attendance';
import MyGroups from './pages/Teacher/MyGroups';
import StudentAttendance from './pages/Student/Attendance';
import Shop from './pages/Student/Shop';
import StudentCoins from './pages/Student/Coins';
import Purchases from './pages/Student/Purchases';
import ShopProducts from './pages/Admin/ShopProducts';
import ShopOrders from './pages/Admin/ShopOrders';
import AdminCoins from './pages/Admin/Coins';
import TeacherCoins from './pages/Teacher/Coins';
import BattleArena from './pages/Student/BattleArena';
import BattleRoom from './pages/Student/BattleRoom';
import AdminBattles from './pages/Admin/Battles';
import Settings from './pages/Admin/Settings';
import AdminTelegram from './pages/Admin/Telegram';
import StudentProfile from './pages/Student/Profile';
import StudentHome from './features/student/StudentHome';
import TeacherHome from './features/teacher/TeacherHome';
import FinancierLayout from './layouts/Financier/FinancierLayout';
import TeacherLayout from './layouts/Teacher/TeacherLayout';
import StudentLayout from './layouts/Student/StudentLayout';
import StatusPage from './components/StatusPage';

const AppRoutes = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <>
        <ToastContainer position="bottom-right" theme="light" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-device" element={<DeviceVerificationPage />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="students" element={<Students />} />
            <Route path="groups" element={<Groups />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="payments" element={<Payments />} />
            <Route path="salaries" element={<Salaries />} />
            <Route path="debts" element={<Students debts />} />
            <Route path="shop" element={<ShopProducts />} />
            <Route path="orders" element={<ShopOrders />} />
            <Route path="coins" element={<AdminCoins />} />
            <Route path="battles" element={<AdminBattles />} />
            <Route path="telegram" element={<AdminTelegram />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Financier Routes */}
          <Route
            path="/financier"
            element={
              <ProtectedRoute allowedRoles={['Financier']}>
                <FinancierLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<FinanceOverview />} />
            <Route path="payments" element={<Payments />} />
            <Route path="salaries" element={<Salaries />} />
            <Route path="debts" element={<Students debts />} />
            <Route path="students" element={<Students />} />
          </Route>

          {/* Teacher Routes */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={['Teacher']}>
                <TeacherLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TeacherHome />} />
            <Route path="groups" element={<MyGroups />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="coins" element={<TeacherCoins />} />
          </Route>

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['Student']}>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentHome />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="battle" element={<BattleArena />} />
            <Route path="battle/:id" element={<BattleRoom />} />
            <Route path="shop" element={<Shop />} />
            <Route path="coins" element={<StudentCoins />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="profile" element={<StudentProfile />} />
          </Route>

          <Route path="/forbidden" element={<StatusPage code="403" title="status.forbiddenTitle" text="status.forbiddenText" />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<StatusPage code="404" title="status.notFoundTitle" text="status.notFoundText" />} />
        </Routes>
    </>
  );
};

const App = () => (
  <Provider store={store}>
    <AppRoutes />
  </Provider>
);

export default App;
