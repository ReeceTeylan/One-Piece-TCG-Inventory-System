import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Sun, Moon, LogOut, User as UserIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { useUnreadCount, useNotifications, useNotificationActions } from '@/hooks/use-notifications';
import { fmtDate } from '@/lib/utils';

export function Topbar({ onToggleSidebar, onToggleMobile }: { onToggleSidebar: () => void; onToggleMobile: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  // theme persisted in localStorage('op_theme'); applied pre-paint in index.html
  const unread = useUnreadCount();
  const notifs = useNotifications();
  const { markAllRead, markRead } = useNotificationActions();

  const toggleTheme = () => {
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('op_theme', next ? 'dark' : 'light'); } catch (e) { /* ignore */ }
  };
  const onSearch = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) navigate(`/raw-cards?search=${encodeURIComponent(q.trim())}`); };

  return (
    <header className="flex h-[57px] items-center gap-3 border-b bg-card px-4">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleMobile} aria-label="Open menu"><Menu className="size-5" /></Button>
      <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={onToggleSidebar} aria-label="Collapse sidebar"><Menu className="size-5" /></Button>
      <form onSubmit={onSearch} className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards, sets, customers…" className="bg-muted pl-9" aria-label="Global search" />
      </form>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-5" />
            {(unread.data?.unread ?? 0) > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} className="h-7 text-xs">Mark all read</Button>
          </div>
          <DropdownMenuSeparator />
          <div className="max-h-80 overflow-y-auto">
            {notifs.data?.data.length ? notifs.data.data.map((n) => (
              <DropdownMenuItem key={n.id} onSelect={() => markRead.mutate(n.id)} className="flex-col items-start gap-0.5">
                <div className="flex w-full items-center justify-between">
                  <span className="text-[13px] font-medium">{n.title}</span>
                  {!n.isRead && <Check className="size-3.5 text-muted-foreground" />}
                </div>
                {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[10px] text-muted-foreground">{fmtDate(n.createdAt)}</span>
              </DropdownMenuItem>
            )) : <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications</div>}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-muted" aria-label="Profile menu">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{user?.fullName?.[0] ?? 'U'}</span>
            <span className="hidden text-left sm:block"><span className="block text-[13px] font-semibold leading-tight">{user?.fullName}</span><span className="block text-[11px] text-muted-foreground">{user?.role === 'OWNER' ? 'Full access' : 'Limited'}</span></span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/settings')}><UserIcon className="size-4" /> Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => logout()}><LogOut className="size-4" /> Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
