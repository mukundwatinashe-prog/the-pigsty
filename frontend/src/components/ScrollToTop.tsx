import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

function resetScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/** Reset scroll before paint on client-side navigations (avoids blank off-screen pages). */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }
    resetScroll();
    // Some mobile browsers apply scroll restoration after the first frame.
    const raf = requestAnimationFrame(() => resetScroll());
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);

  return null;
}
