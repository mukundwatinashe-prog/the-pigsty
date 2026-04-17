import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import AppLayout from './components/layout/AppLayout';
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const CompleteProfilePage = lazy(() => import('./pages/auth/CompleteProfilePage'));
const LandingPage = lazy(() => import('./pages/marketing/LandingPage'));
const PrivacyPage = lazy(() => import('./pages/marketing/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/marketing/TermsPage'));
const FarmSelectPage = lazy(() => import('./pages/farms/FarmSelectPage'));
const DashboardPage = lazy(() => import('./pages/farms/DashboardPage'));
const FarmSettingsPage = lazy(() => import('./pages/farms/FarmSettingsPage'));
const PigListPage = lazy(() => import('./pages/pigs/PigListPage'));
const PigDetailPage = lazy(() => import('./pages/pigs/PigDetailPage'));
const PigFormPage = lazy(() => import('./pages/pigs/PigFormPage'));
const PigImportPage = lazy(() => import('./pages/pigs/PigImportPage'));
const ServicedSowsPage = lazy(() => import('./pages/pigs/ServicedSowsPage'));
const PenListPage = lazy(() => import('./pages/pens/PenListPage'));
const PenDetailPage = lazy(() => import('./pages/pens/PenDetailPage'));
const WeightLogPage = lazy(() => import('./pages/weights/WeightLogPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const AuditLogPage = lazy(() => import('./pages/reports/AuditLogPage'));
const BillingPage = lazy(() => import('./pages/billing/BillingPage'));
const FinancialsPage = lazy(() => import('./pages/financials/FinancialsPage'));
const FeedDashboardPage = lazy(() => import('./pages/feed/FeedDashboardPage'));
const FeedPurchasePage = lazy(() => import('./pages/feed/FeedPurchasePage'));
const FeedDailyUsagePage = lazy(() => import('./pages/feed/FeedDailyUsagePage'));
const FeedUsageHistoryPage = lazy(() => import('./pages/feed/FeedUsageHistoryPage'));
const FeedPurchaseHistoryPage = lazy(() => import('./pages/feed/FeedPurchaseHistoryPage'));
const FeedReportsPage = lazy(() => import('./pages/feed/FeedReportsPage'));
const HelpPage = lazy(() => import('./pages/help/HelpPage'));

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
            <Suspense fallback={<div className="p-4 text-center text-sm text-slate-600">Loading...</div>}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
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
