import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import LandingPage from './pages/marketing/LandingPage';
import PrivacyPage from './pages/marketing/PrivacyPage';
import TermsPage from './pages/marketing/TermsPage';
import FarmSelectPage from './pages/farms/FarmSelectPage';
import DashboardPage from './pages/farms/DashboardPage';
import FarmSettingsPage from './pages/farms/FarmSettingsPage';
import PigListPage from './pages/pigs/PigListPage';
import PigDetailPage from './pages/pigs/PigDetailPage';
import PigFormPage from './pages/pigs/PigFormPage';
import PigImportPage from './pages/pigs/PigImportPage';
import ServicedSowsPage from './pages/pigs/ServicedSowsPage';
import PenListPage from './pages/pens/PenListPage';
import WeightLogPage from './pages/weights/WeightLogPage';
import ReportsPage from './pages/reports/ReportsPage';
import AuditLogPage from './pages/reports/AuditLogPage';
import BillingPage from './pages/billing/BillingPage';
import FinancialsPage from './pages/financials/FinancialsPage';

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
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/farms" element={<FarmSelectPage />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/pigs" element={<PigListPage />} />
                <Route path="/pigs/new" element={<PigFormPage />} />
                <Route path="/pigs/:id" element={<PigDetailPage />} />
                <Route path="/pigs/:id/edit" element={<PigFormPage />} />
                <Route path="/import" element={<PigImportPage />} />
                <Route path="/serviced-sows" element={<ServicedSowsPage />} />
                <Route path="/pens" element={<PenListPage />} />
                <Route path="/weights" element={<WeightLogPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/financials" element={<FinancialsPage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
                <Route path="/settings" element={<FarmSettingsPage />} />
                <Route path="/billing" element={<BillingPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
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
