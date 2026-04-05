import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PiggyBank, Warehouse, Weight, FileSpreadsheet,
  FileText, Settings, LogOut, ChevronLeft, ChevronRight, Upload, CreditCard, Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFarm } from '../../context/FarmContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pigs', icon: PiggyBank, label: 'Pig Inventory' },
  { to: '/pens', icon: Warehouse, label: 'Pens' },
  { to: '/weights', icon: Weight, label: 'Weight Logs' },
  { to: '/import', icon: Upload, label: 'Import Pigs' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/financials', icon: Wallet, label: 'Financials' },
  { to: '/audit-log', icon: FileSpreadsheet, label: 'Audit Log' },
  { to: '/billing', icon: CreditCard, label: 'Billing' },
  { to: '/settings', icon: Settings, label: 'Farm Settings' },
];

type SidebarProps = {
  mobileNavOpen?: boolean;
  onNavigate?: () => void;
};

export default function Sidebar({ mobileNavOpen = false, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const { currentFarm } = useFarm();

  const showNavText = mobileNavOpen || !collapsed;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 max-md:w-[min(280px,88vw)] max-md:shadow-xl md:transition-[width] ${
        mobileNavOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
      } ${collapsed ? 'md:w-16' : 'md:w-64'} md:translate-x-0`}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:py-5">
        {showNavText ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-600 md:h-8 md:w-8">
                {currentFarm?.logoUrl ? (
                  <img src={currentFarm.logoUrl} alt={`${currentFarm.name} logo`} className="h-full w-full object-cover" />
                ) : (
                  <img src="/favicon.svg" alt="" className="h-full w-full bg-white object-contain p-0.5" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold text-gray-900">The Pigsty</h1>
                {currentFarm && <p className="truncate text-xs text-gray-500">{currentFarm.name}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="ml-auto shrink-0 rounded-lg p-2 hover:bg-gray-100 max-md:hidden"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={18} />
            </button>
          </>
        ) : (
          <div className="hidden w-full justify-end md:flex">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg p-2 hover:bg-gray-100"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => onNavigate?.()}
            className={({ isActive }) =>
              `flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon size={20} className="shrink-0" />
            {showNavText ? <span>{label}</span> : <span className="sr-only">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {showNavText && user && (
          <div className="mb-3 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium md:h-8 md:w-8">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        )}
        {!showNavText && user && (
          <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={20} className="shrink-0" />
          {showNavText ? <span>Sign Out</span> : <span className="sr-only">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
