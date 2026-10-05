import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.js';
import { CompanyProvider } from './context/CompanyContext.js';
import { ProtectedRoute } from './auth/ProtectedRoute.js';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CreateBidPage } from './pages/CreateBidPage.js';
import { BidDetailPage } from './pages/BidDetailPage.js';
import { ComplianceReviewPage } from './pages/ComplianceReviewPage.js';
import { CompanyProfilePage } from './pages/CompanyProfilePage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AuditHistoryPage } from './pages/AuditHistoryPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { PERMISSIONS } from './utils/permissions.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/bids" replace />} />

            {/* Protected Application Routes inside AppShell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route
                path="/bids"
                element={
                  <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_READ}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids/new"
                element={
                  <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_CREATE}>
                    <CreateBidPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/company-profile"
                element={
                  <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_READ}>
                    <CompanyProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids/:id"
                element={
                  <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_READ}>
                    <BidDetailPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids/:id/compliance/:itemId"
                element={
                  <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_READ}>
                    <ComplianceReviewPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/bids/:id/audit"
                element={
                  <ProtectedRoute requiredPermission={PERMISSIONS.AUDIT_READ}>
                    <AuditHistoryPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};
