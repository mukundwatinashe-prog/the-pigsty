import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, UserPlus, Smartphone, FileDown, Shield, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/BrandLogo';
import { track } from '../../lib/analytics';
import { apiErrorMessage } from '../../services/api';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser(data.name, data.email, data.password);
      track('sign_up', { method: 'email' });
      toast.success('Account created! Welcome to The Pigsty');
      navigate('/farms');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Registration failed'));
    }
  };

  return (
    <div className="flex min-h-dvh min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-safe py-4 pb-safe pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo size="xl" />
          </div>
          <Link to="/" className="text-sm text-primary-600 hover:text-primary-700 mb-4 inline-block">
            ← Back to home
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1">
            Built for smallholders and family farms — free for up to 100 pigs per farm. Works on your phone; export reports anytime. If you
            live in the <strong className="font-medium text-gray-700">diaspora</strong>, use The Pigsty to stay on top of your home farm:
            herd, weights, sales, and team activity in one place so you can manage with comfort and account for everything.
          </p>
          <ul className="mx-auto mt-4 flex max-w-sm flex-col gap-2 text-left text-xs text-gray-600 sm:text-sm">
            <li className="flex items-start gap-2">
              <Shield className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
              <span>No credit card to start · Your farm data is yours to export</span>
            </li>
            <li className="flex items-start gap-2">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
              <span>Use in the browser on Android or iPhone — add to home screen like an app</span>
            </li>
            <li className="flex items-start gap-2">
              <FileDown className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
              <span>
                <a href="/api/public/import-template" download className="font-medium text-primary-700 hover:underline">
                  Download the free Excel template
                </a>{' '}
                before or after you sign up
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Globe className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
              <span>
                Overseas? Oversee your farm back home with shared access for family or workers — clear numbers, not guesswork.
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <input
                {...register('name')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                placeholder="John Doe"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition pr-10"
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <input
                {...register('confirmPassword')}
                type="password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                placeholder="Re-enter password"
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4 px-2">
            By creating an account you agree to our{' '}
            <Link to="/terms" className="text-primary-600 hover:underline">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-primary-600 hover:underline">Privacy policy</Link>.
          </p>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
