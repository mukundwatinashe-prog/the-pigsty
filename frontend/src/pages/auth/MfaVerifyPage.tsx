import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/BrandLogo';
import { apiErrorMessage } from '../../services/api';

export default function MfaVerifyPage() {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { mfaChallenge?: string; redirect?: string } | null;
  const challenge = state?.mfaChallenge;

  if (!challenge) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600">MFA session expired.</p>
        <Link to="/login" className="text-primary-600 hover:underline">
          Sign in again
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setSubmitting(true);
    try {
      const u = await completeMfaLogin(challenge, code);
      toast.success('Verified');
      const dest = state?.redirect ?? (u.phone?.trim() ? '/farms' : '/complete-profile');
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Invalid code'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <BrandLogo size="lg" linkToHome />
          <h1 className="mt-4 flex items-center justify-center gap-2 text-xl font-bold text-gray-900">
            <Shield className="size-5 text-primary-600" />
            Two-factor verification
          </h1>
          <p className="mt-1 text-sm text-gray-500">Enter the 6-digit code from your authenticator app</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.3em]"
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          <button
            type="submit"
            disabled={code.length !== 6 || submitting}
            className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
