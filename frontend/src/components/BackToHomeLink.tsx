import { Link } from 'react-router-dom';
import { isNativeApp } from '../lib/native';

/**
 * "Back to home" link for auth pages. Hidden in the native app, which has no
 * marketing home page (the app opens straight to login).
 */
export function BackToHomeLink() {
  if (isNativeApp()) return null;
  return (
    <Link
      to="/"
      className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary-700 hover:text-primary-800"
    >
      ← Back to home
    </Link>
  );
}
