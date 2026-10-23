import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { BottomTabs } from '@/components/layout/BottomTabs';
import { SailingProgress } from '@/components/common/Nautical';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-[100dvh] overflow-hidden md:h-screen">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}
      {/* min-w-0 lets this column shrink below its content width — without it the
          sidebar's width pushes the page sideways on mobile. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} onToggleMobile={() => setMobileOpen((o) => !o)} />
        {/* Zero-height anchor: the loading ship overlays the top of the page without shifting it. */}
        <div className="relative h-0"><SailingProgress /></div>
        {/* min-h-0 lets children shrink below their content height so the table,
            not the page, is what scrolls. */}
        {/* Bottom padding on phones keeps the last row clear of the tab bar. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-4 md:overflow-hidden md:pb-4"><Outlet /></main>
      </div>
      <BottomTabs onMore={() => setMobileOpen(true)} />
    </div>
  );
}