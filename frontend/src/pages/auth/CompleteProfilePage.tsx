import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { apiErrorMessage } from '../../services/api';
import type { User } from '../../types';

export default function CompleteProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(user?.phone ?? '');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch<{ user: User }>('/auth/profile', { phone: phone.trim() });
      return data.user;
    },
    onSuccess: (u) => {
      if (u) updateUser(u);
      toast.success('Phone number saved');
      navigate('/farms', { replace: true });
    },
    onError: (e: unknown) => toast.error(apiErrorMessage(e, 'Could not save')),
  });

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add your phone number</h1>
        <p className="mt-2 text-sm text-gray-600">
          We need a mobile number on file for account security and password reset by SMS. This matches what email sign-ups provide at registration.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <label htmlFor="complete-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
          Mobile number <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            id="complete-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            placeholder="8–15 digits, include country code"
            autoComplete="tel"
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">Use the same format you would for SMS (digits only is fine).</p>

        <button
          type="button"
          disabled={mutation.isPending || phone.replace(/\D/g, '').length < 8}
          onClick={() => mutation.mutate()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Continue
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          <button
            type="button"
            className="text-primary-600 hover:underline"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
          {' · '}
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
