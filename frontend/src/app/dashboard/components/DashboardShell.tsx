"use client";

import Sidebar from "@/app/dashboard/components/Sidebar";
import TopBar from "@/app/dashboard/components/TopBar";

export default function DashboardShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: string;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100 overflow-hidden">
      <Sidebar active={active} />
      <main className="ml-64 flex h-screen flex-1 flex-col overflow-hidden">
        <TopBar />
        <section className="flex-1 overflow-y-auto bg-slate-100 p-8">
          {children}
        </section>
      </main>
    </div>
  );
}

