import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { Spinner } from '@/components/ui/spinner';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';

// Route-level code splitting: every non-core page is lazy-loaded.
const RawCardsPage = lazy(() => import('@/pages/RawCards').then((m) => ({ default: m.RawCardsPage })));
const SlabsPage = lazy(() => import('@/pages/Slabs').then((m) => ({ default: m.SlabsPage })));
const CustomersPage = lazy(() => import('@/pages/Customers').then((m) => ({ default: m.CustomersPage })));
const SalesWizardPage = lazy(() => import('@/pages/SalesWizard').then((m) => ({ default: m.SalesWizardPage })));
const SalesHistoryPage = lazy(() => import('@/pages/SalesHistory').then((m) => ({ default: m.SalesHistoryPage })));
const PaymentsPage = lazy(() => import('@/pages/Payments').then((m) => ({ default: m.PaymentsPage })));
const ShipmentsPage = lazy(() => import('@/pages/Shipments').then((m) => ({ default: m.ShipmentsPage })));
const AnalyticsPage = lazy(() => import('@/pages/Analytics').then((m) => ({ default: m.AnalyticsPage })));
const ReportsPage = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.ReportsPage })));
const FavoritesPage = lazy(() => import('@/pages/Favorites').then((m) => ({ default: m.FavoritesPage })));
const NotificationsPage = lazy(() => import('@/pages/Notifications').then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })));
const ActivityLogsPage = lazy(() => import('@/pages/ActivityLogs').then((m) => ({ default: m.ActivityLogsPage })));
const FacebookGeneratorPage = lazy(() => import('@/pages/FacebookGenerator').then((m) => ({ default: m.FacebookGeneratorPage })));

const s = (el: ReactNode): ReactNode => (
  <Suspense fallback={<div className="grid place-items-center py-24"><Spinner /></div>}>{el}</Suspense>
);

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/raw-cards', element: s(<RawCardsPage />) },
          { path: '/slabs', element: s(<SlabsPage />) },
          { path: '/customers', element: s(<CustomersPage />) },
          { path: '/sales', element: s(<SalesWizardPage />) },
          { path: '/sales-history', element: s(<SalesHistoryPage />) },
          { path: '/payments', element: s(<PaymentsPage />) },
          { path: '/shipments', element: s(<ShipmentsPage />) },
          { path: '/analytics', element: s(<AnalyticsPage />) },
          { path: '/reports', element: s(<ReportsPage />) },
          { path: '/facebook', element: s(<FacebookGeneratorPage />) },
          { path: '/favorites', element: s(<FavoritesPage />) },
          { path: '/notifications', element: s(<NotificationsPage />) },
        ],
      },
      {
        element: <ProtectedRoute ownerOnly />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/settings', element: s(<SettingsPage />) },
              { path: '/activity-logs', element: s(<ActivityLogsPage />) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
