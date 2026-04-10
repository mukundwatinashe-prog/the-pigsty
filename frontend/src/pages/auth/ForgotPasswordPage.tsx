import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Smartphone, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { apiErrorMessage } from '../../services/api';
import { BrandLogo } from '../../components/BrandLogo';

const step1Schema = z
  .object({
    channel: z.enum(['email', 'phone']),
    email: z.string().optional(),
    phone: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.channel === 'email') {
      const e = (d.email ?? '').trim();
      if (!e) ctx.addIssue({ code: 'custom', message: 'Email required', path: ['email'] });
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        ctx.addIssue({ code: 'custom', message: 'Valid email required', path: ['email'] });
      }
    } else {
      const p = (d.phone ?? '').trim().replace(/\D/g, '');
      if (p.length < 8) ctx.addIssue({ code: 'custom', message: 'Enter at least 8 digits', path: ['phone'] });
    }
  });

type Step1Data = z.infer<typeof step1Schema>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { channel: 'email', email: '', phone: '' },
  });
  const channel = watch('channel');

  const onSubmit = async (data: Step1Data) => {
    try {
      const body =
        data.channel === 'email'
          ? { email: (data.email ?? '').trim().toLowerCase() }
          : { phone: (data.phone ?? '').trim() };
      await api.post('/auth/forgot-password', body);
      toast.success('If an account exists, a code was sent');
      const state =
        data.channel === 'email'
          ? { email: (data.email ?? '').trim().toLowerCase() }
          : { phone: (data.phone ?? '').trim() };
      navigate('/reset-password', { state, replace: true });
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Request failed'));
    }
  };

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
          <div className="mb-8 text-center">
            <div className="mx-auto flex flex-col items-center gap-0">
              <BrandLogo size="xl" />
              <h1 className="-mt-2 text-2xl font-bold text-gray-900 sm:-mt-2.5">Reset your password</h1>
            </div>
            <p className="mt-1 text-gray-500">We’ll send a 6-digit code to your email or phone</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <fieldset>
                <legend className="sr-only">How to receive the code</legend>
                <div className="flex gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input type="radio" value="email" {...register('channel')} className="text-primary-600" />
                    <Mail className="size-4 text-gray-600" aria-hidden />
                    <span className="text-sm font-medium text-gray-800">Email</span>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input type="radio" value="phone" {...register('channel')} className="text-primary-600" />
                    <Smartphone className="size-4 text-gray-600" aria-hidden />
                    <span className="text-sm font-medium text-gray-800">Phone</span>
                  </label>
                </div>
              </fieldset>

              {channel === 'email' ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Email address</label>
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mobile number</label>
                  <input
                    {...register('phone')}
                    type="tel"
                    autoComplete="tel"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                    placeholder="Include country code, e.g. 263771234567"
                  />
                  <p className="mt-1 text-xs text-gray-500">Same number you used at sign-up (8–15 digits).</p>
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white transition hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 disabled:opacity-50"
              >
                {isSubmitting ? 'Sending…' : 'Send code'}
              </button>

              <Link to="/login" className="mt-4 block text-center text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft size={14} className="mr-1 inline" /> Back to login
              </Link>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
