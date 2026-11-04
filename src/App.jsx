import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
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

const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ToastContainer position="bottom-right" theme="dark" />
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
            <Route path="groups" element={<div className="p-8 text-white">Group Management (Coming Soon)</div>} />
            <Route path="settings" element={<div className="p-8 text-white">Settings (Coming Soon)</div>} />
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
            <Route index element={<div className="p-8 text-white">Financier Dashboard (Coming Soon)</div>} />
            <Route path="payments" element={<div className="p-8 text-white">Payments (Coming Soon)</div>} />
            <Route path="debts" element={<div className="p-8 text-white">Debts (Coming Soon)</div>} />
            <Route path="students" element={<div className="p-8 text-white">Students (Coming Soon)</div>} />
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
            <Route index element={<div className="p-8 text-white">Teacher Dashboard (Coming Soon)</div>} />
            <Route path="groups" element={<div className="p-8 text-white">Groups (Coming Soon)</div>} />
            <Route path="schedule" element={<div className="p-8 text-white">Schedule (Coming Soon)</div>} />
            <Route path="attendance" element={<div className="p-8 text-white">Attendance (Coming Soon)</div>} />
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
            <Route index element={<div className="p-8 text-white">Student Dashboard (Coming Soon)</div>} />
            <Route path="profile" element={<div className="p-8 text-white">Profile (Coming Soon)</div>} />
            <Route path="courses" element={<div className="p-8 text-white">Courses (Coming Soon)</div>} />
            <Route path="schedule" element={<div className="p-8 text-white">Schedule (Coming Soon)</div>} />
          </Route>

          <Route path="/forbidden" element={<div className="p-8 text-white">Access Forbidden</div>} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<div className="p-8 text-white">404 Not Found</div>} />
        </Routes>
      </PersistGate>
    </Provider>
  );
};

export default App;
