"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
