import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound, ArrowLeft, Clock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { apiErrorMessage } from '../../services/api';
import { BrandLogo } from '../../components/BrandLogo';

const CODE_EXPIRY_SECONDS = 300;

const passwordField = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol');

const schema = z
  .object({
    channel: z.enum(['email', 'phone']),
    email: z.string().optional(),
    phone: z.string().optional(),
    code: z.string().min(8, 'Enter the 8-digit code').max(12),
    password: passwordField,
    confirmPassword: z.string(),
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
    if (d.password !== d.confirmPassword) {
      ctx.addIssue({ code: 'custom', message: 'Passwords do not match', path: ['confirmPassword'] });
    }
  });

type FormData = z.infer<typeof schema>;

type LocationState = {
  email?: string;
  phone?: string;
  codeSentAt?: string;
  expiresInSeconds?: number;
} | null;

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function secondsRemaining(sentAtMs: number, expiresInSeconds: number): number {
  const elapsed = Math.floor((Date.now() - sentAtMs) / 1000);
  return Math.max(0, expiresInSeconds - elapsed);
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;
  const [showPassword, setShowPassword] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const expiresInSeconds = state?.expiresInSeconds ?? CODE_EXPIRY_SECONDS;
  const initialSentAtMs = state?.codeSentAt ? new Date(state.codeSentAt).getTime() : Date.now();
  const [sentAtMs, setSentAtMs] = useState(initialSentAtMs);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsRemaining(initialSentAtMs, expiresInSeconds));

  const defaultChannel = state?.email ? 'email' : state?.phone ? 'phone' : 'email';

  const { register, handleSubmit, control, getValues, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      channel: defaultChannel,
      email: state?.email ?? '',
      phone: state?.phone ?? '',
      code: '',
      password: '',
      confirmPassword: '',
    },
  });
  const channel = useWatch({ control, name: 'channel' });

  useEffect(() => {
    const tick = () => setSecondsLeft(secondsRemaining(sentAtMs, expiresInSeconds));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sentAtMs, expiresInSeconds]);

  const resendCode = useCallback(async () => {
    const data = getValues();
    setIsResending(true);
    try {
      const body =
        data.channel === 'email'
          ? { email: (data.email ?? '').trim().toLowerCase() }
          : { phone: (data.phone ?? '').trim() };
      const { data: res } = await api.post<{ sentAt?: string; expiresInSeconds?: number }>(
        '/auth/forgot-password',
        body,
      );
      const nextSentAt = res.sentAt ? new Date(res.sentAt).getTime() : Date.now();
      setSentAtMs(nextSentAt);
      setSecondsLeft(res.expiresInSeconds ?? CODE_EXPIRY_SECONDS);
      toast.success('If an account exists, a new code was sent');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Could not resend code'));
    } finally {
      setIsResending(false);
    }
  }, [getValues]);

  const onSubmit = async (data: FormData) => {
    if (secondsLeft <= 0) {
      toast.error('Your code has expired. Request a new one.');
      return;
    }
    try {
      const body =
        data.channel === 'email'
          ? {
              email: (data.email ?? '').trim().toLowerCase(),
              code: data.code.replace(/\D/g, ''),
              password: data.password,
            }
          : {
              phone: (data.phone ?? '').trim(),
              code: data.code.replace(/\D/g, ''),
              password: data.password,
            };
      await api.post('/auth/reset-password', body);
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Reset failed'));
    }
  };

  const codeExpired = secondsLeft <= 0;

  return (
    <div className="relative min-h-dvh min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 px-safe pb-safe">
      <Link
        to="/"
        className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        ← Back to home
      </Link>
      <div className="flex min-h-dvh min-h-screen items-center justify-center py-4 pt-14 sm:pt-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex flex-col items-center gap-0">
              <BrandLogo size="xl" linkToHome />
              <h1 className="-mt-2 text-2xl font-bold text-gray-900 sm:-mt-2.5">Enter your code</h1>
            </div>
            <p className="mt-1 text-gray-500">Use the 8-digit code we sent, then choose a new password</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
            <div
              className={`mb-5 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                codeExpired
                  ? 'bg-red-50 text-red-700'
                  : secondsLeft <= 60
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-primary-50 text-primary-800'
              }`}
              role="status"
              aria-live="polite"
            >
              <Clock className="size-4 shrink-0" aria-hidden />
              {codeExpired ? (
                <span>Code expired — request a new one below</span>
              ) : (
                <span>Code expires in {formatCountdown(secondsLeft)}</span>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <fieldset>
                <legend className="sr-only">Account</legend>
                <div className="flex gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input type="radio" value="email" {...register('channel')} className="text-primary-600" />
                    Email
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                    <input type="radio" value="phone" {...register('channel')} className="text-primary-600" />
                    Phone
                  </label>
                </div>
              </fieldset>

              {channel === 'email' ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    {...register('phone')}
                    type="tel"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">8-digit code</label>
                <input
                  {...register('code')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-lg tracking-widest outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  placeholder="00000000"
                />
                {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">New password</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || codeExpired}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 font-medium text-white transition hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 disabled:opacity-50"
              >
                <KeyRound size={18} />
                {isSubmitting ? 'Saving…' : 'Update password'}
              </button>

              <div className="flex flex-col gap-2 text-center text-sm text-gray-500">
                <button
                  type="button"
                  onClick={() => void resendCode()}
                  disabled={!codeExpired || isResending}
                  className="text-primary-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                >
                  {isResending
                    ? 'Sending…'
                    : codeExpired
                      ? 'Send a new code'
                      : `Resend code in ${formatCountdown(secondsLeft)}`}
                </button>
                <Link to="/forgot-password" className="hover:text-gray-700">
                  Use a different email or phone
                </Link>
                <Link to="/login" className="hover:text-gray-700">
                  <ArrowLeft size={14} className="mr-1 inline" /> Back to login
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
