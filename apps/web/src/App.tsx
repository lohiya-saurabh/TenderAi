import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider.js';
import { CompanyProvider } from '@/context/CompanyContext.js';
import { ThemeProvider } from '@/context/ThemeContext.js';
import { ProtectedRoute } from '@/auth/ProtectedRoute.js';
import { AppShell } from '@/components/layout/AppShell.js';
import { LandingPage } from '@/pages/LandingPage.js';
import { LoginPage } from '@/pages/LoginPage.js';
import { LegacyClauseRedirect } from '@/pages/LegacyClauseRedirect.js';
import { PERMISSIONS } from '@/utils/permissions.js';
import { ScrollToTop } from '@/components/common/ScrollToTop.js';

// Pages load on demand so the first visit downloads only what it shows.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const PricingPage = page(() => import('@/pages/PricingPage.js'), 'PricingPage');
const SignupPage = page(() => import('@/pages/SignupPage.js'), 'SignupPage');
const OnboardingPage = page(() => import('@/pages/OnboardingPage.js'), 'OnboardingPage');
const AcceptInvitePage = page(() => import('@/pages/AcceptInvitePage.js'), 'AcceptInvitePage');
const DashboardPage = page(() => import('@/pages/DashboardPage.js'), 'DashboardPage');
const CreateBidPage = page(() => import('@/pages/CreateBidPage.js'), 'CreateBidPage');
const BidDetailPage = page(() => import('@/pages/BidDetailPage.js'), 'BidDetailPage');
const ClauseWorkspacePage = page(
  () => import('@/pages/ClauseWorkspacePage.js'),
  'ClauseWorkspacePage',
);
const ConflictsPage = page(() => import('@/pages/ConflictsPage.js'), 'ConflictsPage');
const ChecklistPage = page(() => import('@/pages/ChecklistPage.js'), 'ChecklistPage');
const CompanyProfilePage = page(
  () => import('@/pages/CompanyProfilePage.js'),
  'CompanyProfilePage',
);
const ProfilePage = page(() => import('@/pages/ProfilePage.js'), 'ProfilePage');
const SettingsPage = page(() => import('@/pages/SettingsPage.js'), 'SettingsPage');
const AuditHistoryPage = page(() => import('@/pages/AuditHistoryPage.js'), 'AuditHistoryPage');
const NotFoundPage = page(() => import('@/pages/NotFoundPage.js'), 'NotFoundPage');

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ThemeProvider>
        <AuthProvider>
          <CompanyProvider>
            <Suspense fallback={null}>
              <Routes>
                {/* Public Marketing & Pricing Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />

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

                  <Route
                    path="/bids/:id/checklist"
                    element={
                      <ProtectedRoute requiredPermission={PERMISSIONS.BIDS_READ}>
                        <ChecklistPage />
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
            </Suspense>
          </CompanyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
