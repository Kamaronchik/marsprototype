import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PageSkeleton from './PageSkeleton';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, sessionChecked } = useSelector((state) => state.auth);
  const location = useLocation();

  // Wait for the server to confirm the session, with a page-shaped skeleton instead of a blank screen.
  if (!sessionChecked) return <PageSkeleton />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};

export default ProtectedRoute;
