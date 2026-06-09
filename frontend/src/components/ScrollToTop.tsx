import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Reset scroll on client-side navigations so auth/marketing pages are not stuck off-screen. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
