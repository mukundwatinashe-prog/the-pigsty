import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';
import { farmService } from '../../services/farm.service';
import { BrandLogo } from '../../components/BrandLogo';
import { apiErrorMessage } from '../../services/api';
import type { Role } from '../../types';

function roleLabel(role: Role) {
  if (role === 'FARM_MANAGER') return 'Farm Manager';
  if (role === 'WORKER') return 'Worker';
  if (role === 'OWNER') return 'Owner';
  return role;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 px-safe pb-safe">
      <Link
        to="/"
        className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        ← Back to home
      </Link>
      <div className="flex min-h-dvh min-h-screen items-center justify-center py-4 pt-14 sm:pt-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-0 text-center">
            <BrandLogo size="xl" linkToHome />
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setCurrentFarm } = useFarm();

  const {
    data: invite,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => farmService.getInvitation(token),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => farmService.acceptInvitation(token),
    onSuccess: (data) => {
      setCurrentFarm(null);
      localStorage.setItem('currentFarmId', JSON.stringify({ id: data.farmId, name: data.farmName }));
      toast.success(data.alreadyMember ? `You're already part of ${data.farmName}` : `Welcome to ${data.farmName}!`);
      navigate('/farms');
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, 'Could not accept invitation'));
    },
  });

  if (!token) {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-red-500" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Invalid invitation link</h1>
        </div>
      </Shell>
    );
  }

  if (isLoading || authLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-6 text-gray-500">
          <Loader2 className="size-8 animate-spin text-primary-600" />
          <p className="text-sm">Loading invitation…</p>
        </div>
      </Shell>
    );
  }

  if (isError || !invite) {
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-red-500" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Invitation not found</h1>
          <p className="mt-2 text-sm text-gray-600">
            This invitation link is invalid. Ask the farm owner to send you a new one.
          </p>
        </div>
      </Shell>
    );
  }

  if (invite.status !== 'PENDING') {
    const reason =
      invite.status === 'EXPIRED'
        ? 'This invitation has expired.'
        : invite.status === 'ACCEPTED'
          ? 'This invitation has already been accepted.'
          : 'This invitation is no longer active.';
    return (
      <Shell>
        <div className="text-center">
          <AlertCircle className="mx-auto size-10 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{reason}</p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-primary-700"
          >
            Go to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  const redirectTarget = `/invite/${token}`;
  const emailMatches = user && user.email.trim().toLowerCase() === invite.email.trim().toLowerCase();

  return (
    <Shell>
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-10 text-primary-600" />
        <h1 className="mt-3 text-xl font-bold text-gray-900">Join {invite.farmName}</h1>
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-gray-900">{invite.inviterName}</span> invited you to join{' '}
          <span className="font-medium text-gray-900">{invite.farmName}</span> on The Pigsty as a{' '}
          <span className="font-medium text-gray-900">{roleLabel(invite.role)}</span>.
        </p>
        <p className="mt-2 text-xs text-gray-500">Invitation sent to {invite.email}</p>
      </div>

      <div className="mt-6">
        {!user ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-600">
              Create an account or sign in with <span className="font-medium">{invite.email}</span> to accept.
            </p>
            <Link
              to={`/register?redirect=${encodeURIComponent(redirectTarget)}&email=${encodeURIComponent(invite.email)}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-primary-700"
            >
              <UserPlus size={18} />
              Create an account
            </Link>
            <Link
              to={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <LogIn size={18} />
              I already have an account
            </Link>
          </div>
        ) : !emailMatches ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You're signed in as <span className="font-medium">{user.email}</span>, but this invitation was sent to{' '}
              <span className="font-medium">{invite.email}</span>. Sign in with that email to accept.
            </div>
            <Link
              to={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-primary-700"
            >
              <LogIn size={18} />
              Switch account
            </Link>
          </div>
        ) : (
          <button
            type="button"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-primary-700 disabled:opacity-50"
          >
            {acceptMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Accept invitation
          </button>
        )}
      </div>
    </Shell>
  );
}
