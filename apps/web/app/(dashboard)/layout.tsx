"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { Sidebar } from "@/components/layout/sidebar";
import { TopHeader } from "@/components/layout/top-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-zinc-50">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          <TopHeader />
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
