import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-accent-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-accent-50">
      <button
        type="button"
        className="fixed left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm md:hidden"
        aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen((v) => !v)}
      >
        {mobileNavOpen ? <X className="size-5 text-gray-800" /> : <Menu className="size-5 text-gray-800" />}
      </button>

      <Sidebar
        mobileNavOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="min-h-screen border-gray-100/80 px-safe pb-safe pt-[4.75rem] md:ml-64 md:border-l md:px-6 md:py-6 md:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
