"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Role } from "@/types/auth";
import { hasRole } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login");
        return;
      }

      if (requiredRole && user && !hasRole(user.role.name, requiredRole)) {
        router.push("/unauthorized");
      }
    }
  }, [user, loading, isAuthenticated, requiredRole, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && user && !hasRole(user.role.name, requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
