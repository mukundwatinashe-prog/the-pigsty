import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import AppLayout from './components/layout/AppLayout';
import MarketingLayout from './components/layout/MarketingLayout';
import { ScrollToTop } from './components/ScrollToTop';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import { ContactPage, LandingPage, PrivacyPage, TermsPage } from './pages/marketing/publicPages';
import { lazyWithRetry } from './lib/lazyWithRetry';

const ForgotPasswordPage = lazyWithRetry(() => import('./pages/auth/ForgotPasswordPage'), 'forgot-password');
const ResetPasswordPage = lazyWithRetry(() => import('./pages/auth/ResetPasswordPage'), 'reset-password');
const CompleteProfilePage = lazyWithRetry(() => import('./pages/auth/CompleteProfilePage'), 'complete-profile');
const InviteAcceptPage = lazyWithRetry(() => import('./pages/invite/InviteAcceptPage'), 'invite');
const FarmSelectPage = lazyWithRetry(() => import('./pages/farms/FarmSelectPage'), 'farms');
const DashboardPage = lazyWithRetry(() => import('./pages/farms/DashboardPage'), 'dashboard');
const FarmSettingsPage = lazyWithRetry(() => import('./pages/farms/FarmSettingsPage'), 'settings');
const PigListPage = lazyWithRetry(() => import('./pages/pigs/PigListPage'), 'pigs');
const PigDetailPage = lazyWithRetry(() => import('./pages/pigs/PigDetailPage'), 'pig-detail');
const PigFormPage = lazyWithRetry(() => import('./pages/pigs/PigFormPage'), 'pig-form');
const PigImportPage = lazyWithRetry(() => import('./pages/pigs/PigImportPage'), 'import');
const ServicedSowsPage = lazyWithRetry(() => import('./pages/pigs/ServicedSowsPage'), 'serviced-sows');
const PenListPage = lazyWithRetry(() => import('./pages/pens/PenListPage'), 'pens');
const PenDetailPage = lazyWithRetry(() => import('./pages/pens/PenDetailPage'), 'pen-detail');
const WeightLogPage = lazyWithRetry(() => import('./pages/weights/WeightLogPage'), 'weights');
const ReportsPage = lazyWithRetry(() => import('./pages/reports/ReportsPage'), 'reports');
const AuditLogPage = lazyWithRetry(() => import('./pages/reports/AuditLogPage'), 'audit-log');
const BillingPage = lazyWithRetry(() => import('./pages/billing/BillingPage'), 'billing');
const FinancialsPage = lazyWithRetry(() => import('./pages/financials/FinancialsPage'), 'financials');
const FeedDashboardPage = lazyWithRetry(() => import('./pages/feed/FeedDashboardPage'), 'feed');
const FeedPurchasePage = lazyWithRetry(() => import('./pages/feed/FeedPurchasePage'), 'feed-purchase');
const FeedDailyUsagePage = lazyWithRetry(() => import('./pages/feed/FeedDailyUsagePage'), 'feed-daily');
const FeedUsageHistoryPage = lazyWithRetry(() => import('./pages/feed/FeedUsageHistoryPage'), 'feed-usage');
const FeedPurchaseHistoryPage = lazyWithRetry(() => import('./pages/feed/FeedPurchaseHistoryPage'), 'feed-purchases');
const FeedReportsPage = lazyWithRetry(() => import('./pages/feed/FeedReportsPage'), 'feed-reports');
const HelpPage = lazyWithRetry(() => import('./pages/help/HelpPage'), 'help');
const MfaVerifyPage = lazyWithRetry(() => import('./pages/auth/MfaVerifyPage'), 'mfa-verify');
const SecurityDashboardPage = lazyWithRetry(() => import('./pages/security/SecurityDashboardPage'), 'security');
const AdminUsersPage = lazyWithRetry(() => import('./pages/admin/AdminUsersPage'), 'admin-users');
const AccountSecurityPage = lazyWithRetry(() => import('./pages/account/AccountSecurityPage'), 'account-security');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FarmProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-accent-50 px-4">
                  <p className="text-sm font-medium text-gray-600">Loading…</p>
                </div>
              }
            >
              <Routes>
                <Route element={<MarketingLayout />}>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                </Route>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/mfa-verify" element={<MfaVerifyPage />} />
                <Route path="/invite/:token" element={<InviteAcceptPage />} />
                <Route path="/farms" element={<FarmSelectPage />} />
                <Route element={<AppLayout />}>
                  <Route path="/complete-profile" element={<CompleteProfilePage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/pigs" element={<PigListPage />} />
                  <Route path="/pigs/new" element={<PigFormPage />} />
                  <Route path="/pigs/:id" element={<PigDetailPage />} />
                  <Route path="/pigs/:id/edit" element={<PigFormPage />} />
                  <Route path="/import" element={<PigImportPage />} />
                  <Route path="/serviced-sows" element={<ServicedSowsPage />} />
                  <Route path="/pens" element={<PenListPage />} />
                  <Route path="/pens/:penId" element={<PenDetailPage />} />
                  <Route path="/weights" element={<WeightLogPage />} />
                  <Route path="/feed" element={<FeedDashboardPage />} />
                  <Route path="/feed/purchase" element={<FeedPurchasePage />} />
                  <Route path="/feed/daily" element={<FeedDailyUsagePage />} />
                  <Route path="/feed/usage-history" element={<FeedUsageHistoryPage />} />
                  <Route path="/feed/purchases" element={<FeedPurchaseHistoryPage />} />
                  <Route path="/feed/reports" element={<FeedReportsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/financials" element={<FinancialsPage />} />
                  <Route path="/audit-log" element={<AuditLogPage />} />
                  <Route path="/settings" element={<FarmSettingsPage />} />
                  <Route path="/account-security" element={<AccountSecurityPage />} />
                  <Route path="/security" element={<SecurityDashboardPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/help" element={<HelpPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster
            position="top-center"
            containerStyle={{
              top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
            }}
            toastOptions={{ className: '!text-sm sm:!text-base' }}
          />
        </FarmProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
