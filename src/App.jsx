import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch } from 'react-redux';
import { restoreSession } from './features/auth/authSlice';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './app/store';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import LoginPage from './features/auth/LoginPage';
import DeviceVerificationPage from './pages/auth/DeviceVerificationPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/Admin/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import FinancierLayout from './layouts/Financier/FinancierLayout';
import TeacherLayout from './layouts/Teacher/TeacherLayout';
import StudentLayout from './layouts/Student/StudentLayout';
import ComingSoon from './components/ComingSoon';
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
            <Route path="groups" element={<ComingSoon title="Groups" />} />
            <Route path="settings" element={<ComingSoon title="Settings" />} />
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
            <Route index element={<ComingSoon title="Overview" />} />
            <Route path="payments" element={<ComingSoon title="Payments" />} />
            <Route path="debts" element={<ComingSoon title="Debts" />} />
            <Route path="students" element={<ComingSoon title="Students" />} />
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
            <Route index element={<ComingSoon title="Today" />} />
            <Route path="groups" element={<ComingSoon title="My groups" />} />
            <Route path="schedule" element={<ComingSoon title="Schedule" />} />
            <Route path="attendance" element={<ComingSoon title="Attendance" />} />
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
            <Route index element={<ComingSoon title="Home" />} />
            <Route path="profile" element={<ComingSoon title="Profile" />} />
            <Route path="courses" element={<ComingSoon title="Courses" />} />
            <Route path="schedule" element={<ComingSoon title="Schedule" />} />
          </Route>

          <Route path="/forbidden" element={<StatusPage code="403" title="This page is not for your account" text="Your role does not have access here. If you think that is a mistake, ask an administrator." />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<StatusPage code="404" title="We could not find that page" text="The link may be old or mistyped." />} />
        </Routes>
    </>
  );
};

const App = () => (
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <AppRoutes />
    </PersistGate>
  </Provider>
);

export default App;
