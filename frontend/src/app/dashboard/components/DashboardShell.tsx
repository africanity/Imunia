"use client";

import { useState } from "react";
import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";

export default function DashboardShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100 overflow-x-hidden">
      {/* Overlay pour mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <Sidebar active={active} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="h-screen flex-1 flex-col overflow-x-hidden w-full flex min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <section className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 p-2 md:p-8 min-w-0">
          {children}
        </section>
      </main>
    </div>
  );
}

