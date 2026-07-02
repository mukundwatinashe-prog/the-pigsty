import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Shield, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { mfaService } from '../../services/security.service';
import api, { apiErrorMessage } from '../../services/api';

export default function AccountSecurityPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState('');
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [enableCode, setEnableCode] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const startSetup = useMutation({
    mutationFn: () => mfaService.setup(),
    onSuccess: (data) => {
      setSetup(data);
      toast.success('Scan the QR code with your authenticator app');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const enableMfa = useMutation({
    mutationFn: () => mfaService.enable(setup!.secret, enableCode),
    onSuccess: async () => {
      setSetup(null);
      setEnableCode('');
      const { data } = await import('../../services/api').then((m) => m.default.get('/auth/me'));
      updateUser(data.user);
      toast.success('Two-factor authentication enabled');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const disableMfa = useMutation({
    mutationFn: () => mfaService.disable(disableCode),
    onSuccess: async () => {
      setDisableCode('');
      const { data } = await import('../../services/api').then((m) => m.default.get('/auth/me'));
      updateUser(data.user);
      toast.success('Two-factor authentication disabled');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/auth/account'),
    onSuccess: async () => {
      toast.success('Your account has been deleted');
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Shield className="size-7 text-primary-600" />
          Account security
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Protect your account with two-factor authentication (TOTP).
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-gray-600">
              {user?.mfaEnabled
                ? 'Your account requires a code from your authenticator app when signing in.'
                : 'Add an extra layer of protection beyond your password.'}
            </p>
          </div>
          {user?.mfaEnabled ? (
            <ShieldCheck className="size-8 shrink-0 text-green-600" aria-hidden />
          ) : (
            <ShieldOff className="size-8 shrink-0 text-gray-400" aria-hidden />
          )}
        </div>

        {!user?.mfaEnabled && !setup && (
          <button
            type="button"
            onClick={() => startSetup.mutate()}
            disabled={startSetup.isPending}
            className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {startSetup.isPending ? 'Preparing…' : 'Enable 2FA'}
          </button>
        )}

        {setup && !user?.mfaEnabled && (
          <div className="mt-4 space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              Scan this URL in Google Authenticator, Authy, or 1Password:
            </p>
            <code className="block break-all rounded bg-white p-2 text-xs text-gray-800">{setup.otpauthUrl}</code>
            <p className="text-xs text-gray-500">Manual key: {setup.secret}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Verification code</label>
              <input
                value={enableCode}
                onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="6-digit code"
                inputMode="numeric"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => enableMfa.mutate()}
                disabled={enableCode.length !== 6 || enableMfa.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Confirm & enable
              </button>
              <button
                type="button"
                onClick={() => setSetup(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {user?.mfaEnabled && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Enter code to disable 2FA</label>
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="6-digit code"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => disableMfa.mutate()}
              disabled={disableCode.length !== 6 || disableMfa.isPending}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Disable 2FA
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="flex items-center gap-2 font-semibold text-red-700">
          <Trash2 className="size-5" aria-hidden />
          Delete account
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Permanently delete your account and personal data. Farms you solely own are
          archived. If you own a farm that has other members, transfer ownership or remove
          the members first. This cannot be undone.
        </p>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          Type <span className="font-semibold">DELETE</span> to confirm
        </label>
        <input
          value={confirmDelete}
          onChange={(e) => setConfirmDelete(e.target.value)}
          className="mt-1 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="DELETE"
          autoCapitalize="characters"
          autoCorrect="off"
        />
        <button
          type="button"
          onClick={() => deleteAccount.mutate()}
          disabled={confirmDelete !== 'DELETE' || deleteAccount.isPending}
          className="mt-4 block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  );
}
