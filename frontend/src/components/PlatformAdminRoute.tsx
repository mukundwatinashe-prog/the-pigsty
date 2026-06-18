import { Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/** Restricts platform admin pages to accounts in PLATFORM_ADMIN_EMAILS. */
export default function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isPlatformAdmin) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-red-600" />
        <p className="mt-2 font-medium text-red-900">Access denied</p>
        <p className="mt-1 text-sm text-red-700">
          Platform admin access is restricted. Signed in as {user.email}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
