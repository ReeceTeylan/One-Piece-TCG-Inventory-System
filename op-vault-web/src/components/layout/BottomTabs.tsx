import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Layers, BadgeJapaneseYen, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/sales', label: 'Sell', icon: ShoppingCart },
  { to: '/raw-cards', label: 'Raw Cards', icon: Layers },
  { to: '/market-prices', label: 'Market', icon: BadgeJapaneseYen },
];

/** Phone-only tab bar: the four most-used pages one tap away; "More" opens the full menu. */
export function BottomTabs({ onMore }: { onMore: () => void }) {
  const tab = 'flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[10.5px] font-medium transition-colors';
  return (
    <nav aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}
          className={({ isActive }) => cn(tab, isActive ? 'text-primary' : 'text-muted-foreground')}>
          {({ isActive }) => (
            <>
              <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-primary/10')}>
                <t.icon className="size-[19px]" />
              </span>
              {t.label}
            </>
          )}
        </NavLink>
      ))}
      <button type="button" onClick={onMore} className={cn(tab, 'text-muted-foreground')} aria-label="More pages">
        <span className="grid h-7 w-12 place-items-center rounded-full"><Menu className="size-[19px]" /></span>
        More
      </button>
    </nav>
  );
}
