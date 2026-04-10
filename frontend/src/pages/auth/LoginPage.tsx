import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { BrandLogo } from '../../components/BrandLogo';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { track } from '../../lib/analytics';
import { apiErrorMessage } from '../../services/api';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const u = await login(data.email, data.password);
      track('login', { method: 'email' });
      toast.success('Welcome back!');
      navigate(u.phone?.trim() ? '/farms' : '/complete-profile');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Login failed'));
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const u = await loginWithGoogle(idToken);
      track('login', { method: 'google' });
      toast.success('Welcome back!');
      navigate(u.phone?.trim() ? '/farms' : '/complete-profile');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Google sign-in failed'));
    } finally {
      setGoogleLoading(false);
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
            <h1 className="-mt-2 text-2xl font-bold text-gray-900 sm:-mt-2.5">Welcome to The Pigsty</h1>
          </div>
          <p className="mt-1 text-gray-500">Sign in to manage your herd, pens, and reports</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                  placeholder="Enter your password"
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

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
                Forgot password? (email or phone)
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || googleLoading}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-white px-3 text-gray-500">Or</span>
            </div>
          </div>
          <GoogleSignInButton
            text="continue_with"
            className={googleLoading ? 'pointer-events-none opacity-60' : ''}
            onCredential={handleGoogleCredential}
          />

          <p className="text-center text-xs text-gray-500 mt-4">
            <Link to="/privacy" className="text-primary-600 hover:underline">Privacy</Link>
            {' · '}
            <Link to="/terms" className="text-primary-600 hover:underline">Terms</Link>
          </p>
          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:text-primary-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
