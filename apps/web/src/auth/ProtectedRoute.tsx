import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth.js';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton.js';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermission }) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8">
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
      <div className="p-12 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-foreground">No access</h1>
        <p className="text-sm text-muted-foreground">
          You do not have the required permission (<code>{requiredPermission}</code>) to view this
          page.
        </p>
      </div>
    );
  }

  return children;
};
