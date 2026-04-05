import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useState } from 'react';
import { BrandLogo } from '../../components/BrandLogo';

const schema = z.object({
  email: z.string().email('Valid email required'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/forgot-password', data);
      setSent(true);
      toast.success('Reset link sent if email exists');
    } catch {
      toast.error('Something went wrong');
    }
  };

  return (
    <div className="flex min-h-dvh min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-safe py-4 pb-safe pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo size="xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-gray-500 mt-1">We'll send you a reset link</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {sent ? (
            <div className="text-center py-4">
              <Mail className="mx-auto mb-4 text-primary-600" size={48} />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-6">
                If an account exists with that email, we've sent a password reset link.
              </p>
              <Link
                to="/login"
                className="text-primary-600 font-medium hover:text-primary-700 inline-flex items-center gap-1"
              >
                <ArrowLeft size={16} /> Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>

              <Link
                to="/login"
                className="block text-center text-sm text-gray-500 hover:text-gray-700 mt-4"
              >
                <ArrowLeft size={14} className="inline mr-1" /> Back to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
