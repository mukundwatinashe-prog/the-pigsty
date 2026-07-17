import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

const RECOVER_KEY = 'pigtrack:auto-recovered';

/** Catches render errors so a single failure shows a recoverable screen instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render error:', error, info.componentStack);
    // A first unexpected error in a tab is almost always a stale cached build
    // after a deploy (stale service worker / hashed chunks). Auto-recover once by
    // dropping the SW + caches and reloading to fetch the latest build. If it
    // still fails after that, show the recovery screen instead of looping.
    if (!sessionStorage.getItem(RECOVER_KEY)) {
      sessionStorage.setItem(RECOVER_KEY, '1');
      void ErrorBoundary.reloadFresh();
    }
  }

  private static async reloadFresh() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* best-effort — reload regardless */
    }
    window.location.reload();
  }

  private handleReload = () => {
    sessionStorage.removeItem(RECOVER_KEY);
    void ErrorBoundary.reloadFresh();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-accent-50 px-6 text-center">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            The page hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-700"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
