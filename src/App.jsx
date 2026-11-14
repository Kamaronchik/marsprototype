import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch } from 'react-redux';
import { restoreSession } from './features/auth/authSlice';
import { store } from './app/store';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from './features/auth/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import StatusPage from './components/StatusPage';
import PageSkeleton from './components/PageSkeleton';

// Every page is its own chunk: the browser downloads a role's screens only once that role signs
// in, instead of all four roles' worth of code on the very first visit (the login screen).
const DeviceVerificationPage = lazy(() => import('./pages/auth/DeviceVerificationPage'));

const AdminLayout = lazy(() => import('./layouts/Admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const UserManagement = lazy(() => import('./pages/Admin/UserManagement'));
const Groups = lazy(() => import('./pages/Admin/Groups'));
const AdminAttendance = lazy(() => import('./pages/Admin/Attendance'));
const Students = lazy(() => import('./pages/shared/Students'));
const Payments = lazy(() => import('./pages/shared/Payments'));
const Salaries = lazy(() => import('./pages/shared/Salaries'));
const ShopProducts = lazy(() => import('./pages/Admin/ShopProducts'));
const ShopOrders = lazy(() => import('./pages/Admin/ShopOrders'));
const AdminCoins = lazy(() => import('./pages/Admin/Coins'));
const AdminBattles = lazy(() => import('./pages/Admin/Battles'));
const AdminTelegram = lazy(() => import('./pages/Admin/Telegram'));
const Settings = lazy(() => import('./pages/Admin/Settings'));
const Subjects = lazy(() => import('./pages/shared/Subjects'));
const Expenses = lazy(() => import('./pages/shared/Expenses'));
const Reports = lazy(() => import('./pages/shared/Reports'));
const AuditLogs = lazy(() => import('./pages/shared/AuditLogs'));
const Applications = lazy(() => import('./pages/shared/Applications'));
const MySchedule = lazy(() => import('./pages/shared/MySchedule'));

const FinancierLayout = lazy(() => import('./layouts/Financier/FinancierLayout'));
const FinanceOverview = lazy(() => import('./pages/shared/FinanceOverview'));

const TeacherLayout = lazy(() => import('./layouts/Teacher/TeacherLayout'));
const TeacherHome = lazy(() => import('./features/teacher/TeacherHome'));
const TeacherAttendance = lazy(() => import('./pages/Teacher/Attendance'));
const MyGroups = lazy(() => import('./pages/Teacher/MyGroups'));
const TeacherCoins = lazy(() => import('./pages/Teacher/Coins'));
const TeacherHomework = lazy(() => import('./pages/Teacher/Homework'));
const TeacherGrades = lazy(() => import('./pages/Teacher/Grades'));
const TeacherLessons = lazy(() => import('./pages/Teacher/Lessons'));

const AcademicManagerLayout = lazy(() => import('./layouts/AcademicManager/AcademicManagerLayout'));
const AcademicDashboard = lazy(() => import('./pages/AcademicManager/Dashboard'));
const AcademicSchedule = lazy(() => import('./pages/AcademicManager/Schedule'));
const AcademicLessons = lazy(() => import('./pages/AcademicManager/Lessons'));
const AcademicStudents = lazy(() => import('./pages/AcademicManager/Students'));
const AcademicTeachers = lazy(() => import('./pages/AcademicManager/Teachers'));
const AcademicGroups = lazy(() => import('./pages/AcademicManager/Groups'));

const StudentLayout = lazy(() => import('./layouts/Student/StudentLayout'));
const StudentHome = lazy(() => import('./features/student/StudentHome'));
const StudentAttendance = lazy(() => import('./pages/Student/Attendance'));
const BattleArena = lazy(() => import('./pages/Student/BattleArena'));
const BattleRoom = lazy(() => import('./pages/Student/BattleRoom'));
const Shop = lazy(() => import('./pages/Student/Shop'));
const StudentCoins = lazy(() => import('./pages/Student/Coins'));
const Purchases = lazy(() => import('./pages/Student/Purchases'));
const StudentProfile = lazy(() => import('./pages/Student/Profile'));
const StudentHomework = lazy(() => import('./pages/Student/Homework'));
const StudentGrades = lazy(() => import('./pages/Student/Grades'));
const Tutor = lazy(() => import('./pages/Student/Tutor'));

const AppRoutes = () => {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <>
        <ToastContainer position="bottom-right" theme="light" />
        <Suspense fallback={<PageSkeleton />}>
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
            <Route path="subjects" element={<Subjects />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="reports" element={<Reports />} />
            <Route path="applications" element={<Applications />} />
            <Route path="audit" element={<AuditLogs />} />
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
            <Route path="expenses" element={<Expenses />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<AuditLogs />} />
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
            <Route path="schedule" element={<MySchedule />} />
            <Route path="lessons" element={<TeacherLessons />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="homework" element={<TeacherHomework />} />
            <Route path="grades" element={<TeacherGrades />} />
            <Route path="coins" element={<TeacherCoins />} />
          </Route>

          {/* Academic manager Routes */}
          <Route
            path="/academic"
            element={
              <ProtectedRoute allowedRoles={['AcademicManager']}>
                <AcademicManagerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AcademicDashboard />} />
            <Route path="schedule" element={<AcademicSchedule />} />
            <Route path="lessons" element={<AcademicLessons />} />
            <Route path="students" element={<AcademicStudents />} />
            <Route path="teachers" element={<AcademicTeachers />} />
            <Route path="groups" element={<AcademicGroups />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="applications" element={<Applications />} />
            <Route path="audit" element={<AuditLogs />} />
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
            <Route path="schedule" element={<MySchedule />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="homework" element={<StudentHomework />} />
            <Route path="grades" element={<StudentGrades />} />
            <Route path="tutor" element={<Tutor />} />
            <Route path="battle" element={<BattleArena />} />
            <Route path="battle/:id" element={<BattleRoom />} />
            <Route path="shop" element={<Shop />} />
            <Route path="coins" element={<StudentCoins />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="profile" element={<StudentProfile />} />
          </Route>

          {/* A signed-in person with the wrong role lands here (see ProtectedRoute). /forbidden is the old address. */}
          <Route path="/unauthorized" element={<StatusPage code="403" title="status.forbiddenTitle" text="status.forbiddenText" />} />
          <Route path="/forbidden" element={<Navigate to="/unauthorized" replace />} />
          <Route path="/not-found" element={<StatusPage code="404" title="status.notFoundTitle" text="status.notFoundText" />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
        </Suspense>
    </>
  );
};

const App = () => (
  <Provider store={store}>
    <AppRoutes />
  </Provider>
);

export default App;
