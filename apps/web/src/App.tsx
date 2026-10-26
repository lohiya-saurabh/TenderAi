import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider.js';
import { CompanyProvider } from '@/context/CompanyContext.js';
import { ThemeProvider } from '@/context/ThemeContext.js';
import { ProtectedRoute } from '@/auth/ProtectedRoute.js';
import { AppShell } from '@/components/layout/AppShell.js';
import { LandingPage } from '@/pages/LandingPage.js';
import { PricingPage } from '@/pages/PricingPage.js';
import { SignupPage } from '@/pages/SignupPage.js';
import { OnboardingPage } from '@/pages/OnboardingPage.js';
import { LoginPage } from '@/pages/LoginPage.js';
import { DashboardPage } from '@/pages/DashboardPage.js';
import { CreateBidPage } from '@/pages/CreateBidPage.js';
import { BidDetailPage } from '@/pages/BidDetailPage.js';
import { ClauseWorkspacePage } from '@/pages/ClauseWorkspacePage.js';
import { ConflictsPage } from '@/pages/ConflictsPage.js';
import { LegacyClauseRedirect } from '@/pages/LegacyClauseRedirect.js';
import { CompanyProfilePage } from '@/pages/CompanyProfilePage.js';
import { ProfilePage } from '@/pages/ProfilePage.js';
import { SettingsPage } from '@/pages/SettingsPage.js';
import { AuditHistoryPage } from '@/pages/AuditHistoryPage.js';
import { NotFoundPage } from '@/pages/NotFoundPage.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import { ScrollToTop } from '@/components/common/ScrollToTop.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ThemeProvider>
        <AuthProvider>
          <CompanyProvider>
            <Routes>
              {/* Public Marketing & Pricing Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Onboarding Flow */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Application Workspace inside AppShell */}
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
                  path="/bids/:id/clauses"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_READ}>
                      <ClauseWorkspacePage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/bids/:id/conflicts"
                  element={
                    <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_READ}>
                      <ConflictsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Old per-item review links open the same clause in the workspace. */}
                <Route path="/bids/:id/compliance/:itemId" element={<LegacyClauseRedirect />} />

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
      </ThemeProvider>
    </BrowserRouter>
  );
};
