import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { isNativeApp } from '../lib/native';

let gsiScriptPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (gsiScriptPromise) return gsiScriptPromise;
  gsiScriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google Sign-In'));
    document.head.appendChild(s);
  });
  return gsiScriptPromise;
}

type Props = {
  /** Called with the Google ID token (JWT) for POST /api/auth/google */
  onCredential: (idToken: string) => void;
  /** Use "signup_with" on register, "continue_with" on login */
  text?: 'signup_with' | 'continue_with';
  className?: string;
};

/**
 * Renders the official Google button. Requires `VITE_GOOGLE_CLIENT_ID` (same OAuth client ID as backend `GOOGLE_CLIENT_ID`).
 */
/** Web client ID (matches backend GOOGLE_CLIENT_ID) — used to mint an ID token the backend can verify. */
const GOOGLE_WEB_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ||
  '556349279611-bv7sf5q249p3j76m2spr0ums3lermenj.apps.googleusercontent.com';
/** iOS OAuth client ID — set VITE_GOOGLE_IOS_CLIENT_ID after creating the iOS client in Google Cloud. */
const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID?.trim();

/**
 * Native Google Sign-In is off until the Google Cloud config is done (Android
 * OAuth client + SHA-1, iOS client). Ship builds with it OFF so testers don't see
 * a button that errors; set VITE_NATIVE_GOOGLE_ENABLED=true once configured, then
 * rebuild. See docs/MOBILE_GOOGLE_SIGNIN.md.
 */
const NATIVE_GOOGLE_ENABLED = import.meta.env.VITE_NATIVE_GOOGLE_ENABLED === 'true';

/**
 * Web renders the official Google Identity (GSI) button. Native apps can't use GSI
 * (Google blocks OAuth in embedded WebViews), so — when enabled — they use a native
 * sign-in flow via @capgo/capacitor-social-login, which returns an ID token the
 * backend verifies at /api/auth/google — exactly like the web flow.
 */
export function GoogleSignInButton(props: Props) {
  if (isNativeApp()) return NATIVE_GOOGLE_ENABLED ? <NativeGoogleButton {...props} /> : null;
  return <GoogleSignInButtonImpl {...props} />;
}

let socialLoginInitialized = false;

function NativeGoogleButton({ onCredential, text = 'continue_with', className = '' }: Props) {
  const [loading, setLoading] = useState(false);
  const label = text === 'signup_with' ? 'Sign up with Google' : 'Continue with Google';

  const handleClick = async () => {
    setLoading(true);
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');
      if (!socialLoginInitialized) {
        await SocialLogin.initialize({
          google: {
            webClientId: GOOGLE_WEB_CLIENT_ID,
            ...(GOOGLE_IOS_CLIENT_ID ? { iOSClientId: GOOGLE_IOS_CLIENT_ID } : {}),
          },
        });
        socialLoginInitialized = true;
      }
      const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
      const idToken = (res as { result?: { idToken?: string } })?.result?.idToken;
      if (!idToken) throw new Error('Google did not return an ID token');
      onCredential(idToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      if (!/cancel/i.test(msg)) toast.error('Google sign-in failed. Please try email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
      >
        <GoogleGlyph />
        {loading ? 'Connecting…' : label}
      </button>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function GoogleSignInButtonImpl({ onCredential, text = 'continue_with', className = '' }: Props) {
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const fallbackClientId = (() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host === 'the-pigsty.org' || host.endsWith('.the-pigsty.org')) {
        return '556349279611-bv7sf5q249p3j76m2spr0ums3lermenj.apps.googleusercontent.com';
      }
    }
    return undefined;
  })();
  const clientId = envClientId || fallbackClientId;
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const fallbackLabel = text === 'signup_with' ? 'Sign up with Google' : 'Continue with Google';

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    const el = containerRef.current;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        requestAnimationFrame(() => {
          if (cancelled || !el) return;
          const google = window.google;
          if (!google?.accounts?.id) return;

          google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: { credential?: string }) => {
              if (response.credential) callbackRef.current(response.credential);
            },
          });

          el.innerHTML = '';
          const width = Math.min(400, Math.max(280, el.offsetWidth || 320));
          google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          width,
          shape: 'rectangular',
          });
        });
      })
      .catch(() => {
        /* parent can show toast if needed */
      });

    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* ignore */
      }
      el.innerHTML = '';
    };
  }, [clientId, text]);

  if (!clientId) {
    return (
      <div className={className}>
        <button
          type="button"
          disabled
          title="Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in"
          className="flex min-h-[44px] w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-500"
        >
          {fallbackLabel}
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="flex min-h-[44px] w-full justify-center [&>div]:!w-full" />
    </div>
  );
}
