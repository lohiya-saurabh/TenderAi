import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton.js';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermission }) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <LoadingSkeleton height="40px" width="300px" />
        <LoadingSkeleton height="200px" />
        <LoadingSkeleton height="200px" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Access Denied</h2>
        <p style={{ color: 'var(--color-surface-muted)' }}>
          You do not have the required permission (<code>{requiredPermission}</code>) to view this
          page.
        </p>
      </div>
    );
  }

  return children;
};
