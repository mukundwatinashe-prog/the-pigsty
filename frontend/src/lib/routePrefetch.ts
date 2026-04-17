const routeImporters: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('../pages/farms/DashboardPage'),
  '/pigs': () => import('../pages/pigs/PigListPage'),
  '/pens': () => import('../pages/pens/PenListPage'),
  '/weights': () => import('../pages/weights/WeightLogPage'),
  '/feed': () => import('../pages/feed/FeedDashboardPage'),
  '/feed/daily': () => import('../pages/feed/FeedDailyUsagePage'),
  '/feed/purchase': () => import('../pages/feed/FeedPurchasePage'),
  '/feed/purchases': () => import('../pages/feed/FeedPurchaseHistoryPage'),
  '/feed/usage-history': () => import('../pages/feed/FeedUsageHistoryPage'),
  '/feed/reports': () => import('../pages/feed/FeedReportsPage'),
  '/import': () => import('../pages/pigs/PigImportPage'),
  '/reports': () => import('../pages/reports/ReportsPage'),
  '/financials': () => import('../pages/financials/FinancialsPage'),
  '/audit-log': () => import('../pages/reports/AuditLogPage'),
  '/billing': () => import('../pages/billing/BillingPage'),
  '/help': () => import('../pages/help/HelpPage'),
  '/settings': () => import('../pages/farms/FarmSettingsPage'),
};

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(path: string) {
  const importer = routeImporters[path];
  if (!importer || prefetchedRoutes.has(path)) return;
  prefetchedRoutes.add(path);
  void importer();
}

export function prefetchRouteGroup(paths: string[]) {
  for (const path of paths) prefetchRoute(path);
}
