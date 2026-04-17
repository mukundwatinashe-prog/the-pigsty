import { useEffect, useRef } from 'react';

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
export function GoogleSignInButton({ onCredential, text = 'continue_with', className = '' }: Props) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
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
