"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { canManageUsers } from "@/lib/permissions";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const displayName = user.firstName || user.username;
  const securityLevel =
    user.emailVerified && user.phoneVerified ? "Strong" : "Medium";

  const stats = [
    {
      label: "Account Status",
      icon: "solar:user-linear",
      value: user.status,
      hint: `Role: ${user.role.name}`,
      badge: true,
      badgeVariant:
        user.status === "ACTIVE"
          ? "success"
          : user.status === "SUSPENDED"
          ? "destructive"
          : "secondary",
    },
    {
      label: "Email Verification",
      icon: user.emailVerified
        ? "solar:check-circle-linear"
        : "solar:close-circle-linear",
      value: user.emailVerified ? "Verified" : "Not verified",
      hint: user.email,
    },
    {
      label: "Phone Verification",
      icon: user.phoneVerified
        ? "solar:check-circle-linear"
        : "solar:close-circle-linear",
      value: user.phoneVerified ? "Verified" : "Not verified",
      hint: user.phoneNumber || "No phone number",
    },
    {
      label: "Security",
      icon: "solar:shield-check-linear",
      value: securityLevel,
      hint: "Account security level",
    },
    {
      label: "Last Activity",
      icon: "solar:pulse-linear",
      value: formatDateTime(user.updatedAt),
      hint: "Profile last updated",
    },
    {
      label: "Member Since",
      icon: "solar:calendar-linear",
      value: formatDateTime(user.createdAt),
      hint: "Account created",
    },
  ] as const;

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
          Welcome back, {displayName}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Overview of your account and activity.
        </p>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-zinc-500">
                  {stat.label}
                </span>
                <iconify-icon
                  icon={stat.icon}
                  stroke-width="1.5"
                  className="text-zinc-400 text-base"
                />
              </div>
              {"badge" in stat && stat.badge ? (
                <Badge
                  variant={
                    stat.badgeVariant as
                      | "success"
                      | "destructive"
                      | "secondary"
                  }
                >
                  {stat.value}
                </Badge>
              ) : (
                <div className="text-lg font-semibold tracking-tight text-zinc-900">
                  {stat.value}
                </div>
              )}
              <p className="text-xs text-zinc-500 mt-2">{stat.hint}</p>
            </div>
          ))}
        </div>

        {canManageUsers(user.role.name) && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                Quick Actions
              </h3>
            </div>
            <div className="p-5 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/users">Manage Users</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/facilities">View Facilities</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/registry-suggestions">Review Suggestions</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
