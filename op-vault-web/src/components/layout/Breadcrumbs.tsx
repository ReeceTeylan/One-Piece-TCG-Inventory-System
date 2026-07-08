import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const LABELS: Record<string, string> = {
  'raw-cards': 'Raw Cards', slabs: 'Slab Inventory', customers: 'Customers', sales: 'Sales',
  payments: 'Payments', shipments: 'Shipments', analytics: 'Analytics', reports: 'Reports',
  settings: 'Settings', favorites: 'Favorites', notifications: 'Notifications',
  'activity-logs': 'Activity Logs', facebook: 'Facebook Generator',
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  return (
    <nav className="mb-1 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link to="/" className="hover:text-foreground">Home</Link>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="size-3" />
          <span className={i === parts.length - 1 ? 'text-foreground' : ''}>{LABELS[p] ?? p}</span>
        </span>
      ))}
    </nav>
  );
}
