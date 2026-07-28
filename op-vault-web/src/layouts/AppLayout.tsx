import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} onToggleMobile={() => setMobileOpen((o) => !o)} />
        {/* min-h-0 lets children shrink below their content height so the table,
            not the page, is what scrolls. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4"><Outlet /></main>
      </div>
    </div>
  );
}
