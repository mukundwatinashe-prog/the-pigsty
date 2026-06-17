import { Outlet } from 'react-router-dom';

/** Shared shell for public marketing pages. */
export default function MarketingLayout() {
  return (
    <div id="marketing-page-top" className="min-h-dvh overflow-x-clip">
      <Outlet />
    </div>
  );
}
