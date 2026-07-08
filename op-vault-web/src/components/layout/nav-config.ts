import {
  LayoutDashboard, Layers, Award, Users, ShoppingCart, CreditCard, Truck,
  BarChart3, FileText, Star, Bell, ScrollText, Settings, Image, History,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem { to: string; label: string; icon: any; owner?: boolean; }
export interface NavGroup { title: string; items: NavItem[]; }

export const NAV: NavGroup[] = [
  { title: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  { title: 'Inventory', items: [
    { to: '/raw-cards', label: 'Raw Cards', icon: Layers },
    { to: '/slabs', label: 'Slab Inventory', icon: Award },
  ] },
  { title: 'Sales', items: [
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/sales', label: 'Sales', icon: ShoppingCart },
    { to: '/sales-history', label: 'Sales History', icon: History },
    { to: '/payments', label: 'Payments', icon: CreditCard },
    { to: '/shipments', label: 'Shipments', icon: Truck },
  ] },
  { title: 'Insights', items: [
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/reports', label: 'Reports', icon: FileText },
  ] },
  { title: 'Tools', items: [
    { to: '/facebook', label: 'FB Generator', icon: Image },
    { to: '/favorites', label: 'Favorites', icon: Star },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/activity-logs', label: 'Activity Logs', icon: ScrollText, owner: true },
    { to: '/settings', label: 'Settings', icon: Settings, owner: true },
  ] },
];

export function visibleNav(role: Role | undefined): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.owner || role === 'OWNER') }))
    .filter((g) => g.items.length > 0);
}
