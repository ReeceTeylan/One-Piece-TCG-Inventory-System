import { NavLink } from 'react-router-dom';
import { visibleNav } from './nav-config';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import storeLogo from '@/assets/logo.png';

export function Sidebar({ collapsed, mobileOpen, onNavigate }: { collapsed: boolean; mobileOpen: boolean; onNavigate: () => void }) {
  const { user } = useAuth();
  
  return (
    <aside className={cn(
      'flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200',
      collapsed ? 'w-[60px]' : 'w-[236px]',
      'fixed inset-y-0 left-0 z-40 md:static md:translate-x-0',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
    )}>
      {/* Brand Header */}
      <div className="flex h-[57px] items-center gap-2.5 border-b border-white/10 px-4">
        <img 
          src={storeLogo} 
          alt="RB's TCG Logo" 
          className="h-9 w-9 shrink-0 object-contain drop-shadow-md" 
        />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">RB's TCG</div>
            <div className="text-[11px] text-slate-400">Inventory System</div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-2">
        {visibleNav(user?.role).map((group) => (
          <div key={group.title}>
            {!collapsed && <div className="px-2.5 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{group.title}</div>}
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onNavigate}
                className={({ isActive }) => cn(
                  'mb-0.5 flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] transition-colors',
                  isActive ? 'bg-white/12 font-semibold text-white' : 'text-slate-300 hover:bg-white/6 hover:text-white',
                )}
                title={item.label}>
                <item.icon className="size-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}