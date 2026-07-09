"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { healthApi } from "@/lib/api/health";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { HealthStatus } from "@/types/api";
import { canViewHealth } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";

const statusIcons: Record<HealthStatus["status"], string> = {
  healthy: "solar:check-circle-linear",
  degraded: "solar:danger-triangle-linear",
  unhealthy: "solar:close-circle-linear",
};

const statusIconColors: Record<HealthStatus["status"], string> = {
  healthy: "text-emerald-600",
  degraded: "text-amber-500",
  unhealthy: "text-red-600",
};

function StatusBadge({ status }: { status: HealthStatus["status"] }) {
  if (status === "healthy") return <Badge variant="success">Healthy</Badge>;
  if (status === "degraded") return <Badge variant="warning">Degraded</Badge>;
  return <Badge variant="destructive">Unhealthy</Badge>;
}

function StatusIcon({ status }: { status: HealthStatus["status"] }) {
  return (
    <iconify-icon
      icon={statusIcons[status]}
      stroke-width="1.5"
      className={`text-xl ${statusIconColors[status]}`}
    />
  );
}

export default function HealthPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !canViewHealth(user.role.name)) {
      router.push("/unauthorized");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const data = await healthApi.getHealth();
        setHealth(data);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load health status",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!user || !canViewHealth(user.role.name)) {
    return null;
  }

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              System Health
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Monitor system status and performance metrics
            </p>
            {health && (
              <p className="text-xs text-zinc-400 mt-1">
                Last updated: {formatDateTime(health.timestamp)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {loading || !health ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Loading…
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <iconify-icon
                    icon="solar:pulse-linear"
                    stroke-width="1.5"
                    className="text-base text-zinc-500"
                  />
                  <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                    Overall Status
                  </h3>
                </div>
                <StatusBadge status={health.status} />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <StatusIcon status={health.status} />
                  <div>
                    <p className="text-base font-medium text-zinc-900 capitalize">
                      {health.status}
                    </p>
                    <p className="text-sm text-zinc-500">
                      All systems are{" "}
                      {health.status === "healthy"
                        ? "operating normally"
                        : health.status === "degraded"
                        ? "experiencing some issues"
                        : "experiencing critical issues"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                    Database
                  </h3>
                  <iconify-icon
                    icon="solar:database-linear"
                    stroke-width="1.5"
                    className="text-base text-zinc-500"
                  />
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <StatusBadge status={health.checks.database.status} />
                    {health.checks.database.responseTime && (
                      <p className="mt-2 text-xs text-zinc-500">
                        Response time: {health.checks.database.responseTime}ms
                      </p>
                    )}
                  </div>
                  <StatusIcon status={health.checks.database.status} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                    Redis Cache
                  </h3>
                  <iconify-icon
                    icon="solar:server-linear"
                    stroke-width="1.5"
                    className="text-base text-zinc-500"
                  />
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <StatusBadge status={health.checks.redis.status} />
                    {health.checks.redis.responseTime && (
                      <p className="mt-2 text-xs text-zinc-500">
                        Response time: {health.checks.redis.responseTime}ms
                      </p>
                    )}
                  </div>
                  <StatusIcon status={health.checks.redis.status} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                    Memory Usage
                  </h3>
                  <iconify-icon
                    icon="solar:pulse-linear"
                    stroke-width="1.5"
                    className="text-base text-zinc-500"
                  />
                </div>
                <div className="p-5">
                  <div className="text-2xl font-medium tracking-tight text-zinc-900">
                    {health.checks.memory.percentage.toFixed(1)}%
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {(health.checks.memory.used / 1024 / 1024 / 1024).toFixed(2)}{" "}
                    GB /{" "}
                    {(health.checks.memory.total / 1024 / 1024 / 1024).toFixed(2)}{" "}
                    GB
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full ${
                        health.checks.memory.percentage > 80
                          ? "bg-red-500"
                          : health.checks.memory.percentage > 60
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${health.checks.memory.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {health.metrics && (
              <>
                <h2 className="text-base font-medium text-zinc-900 tracking-tight">
                  Application Metrics
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Active Users
                      </h3>
                      <iconify-icon
                        icon="solar:users-group-two-linear"
                        stroke-width="1.5"
                        className="text-base text-zinc-500"
                      />
                    </div>
                    <div className="p-5">
                      <div className="text-2xl font-medium tracking-tight text-zinc-900">
                        {health.metrics.activeUsers}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Currently online
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Active Sessions
                      </h3>
                      <iconify-icon
                        icon="solar:shield-check-linear"
                        stroke-width="1.5"
                        className="text-base text-zinc-500"
                      />
                    </div>
                    <div className="p-5">
                      <div className="text-2xl font-medium tracking-tight text-zinc-900">
                        {health.metrics.activeSessions}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Total sessions
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Login Success Rate
                      </h3>
                      <iconify-icon
                        icon="solar:graph-up-linear"
                        stroke-width="1.5"
                        className="text-base text-zinc-500"
                      />
                    </div>
                    <div className="p-5">
                      <div className="text-2xl font-medium tracking-tight text-zinc-900">
                        {(health.metrics.loginSuccessRate * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Successful logins
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Password Resets
                      </h3>
                      <iconify-icon
                        icon="solar:pulse-linear"
                        stroke-width="1.5"
                        className="text-base text-zinc-500"
                      />
                    </div>
                    <div className="p-5">
                      <div className="text-2xl font-medium tracking-tight text-zinc-900">
                        {health.metrics.passwordResets}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">This period</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
                <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                  Health Check Details
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium text-zinc-900">
                      Monitoring interval
                    </h4>
                    <p className="text-zinc-500 mt-1">
                      Health status is automatically refreshed every 30 seconds
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-900">
                      Status definitions
                    </h4>
                    <ul className="mt-2 space-y-2 text-zinc-500">
                      <li className="flex items-center gap-2">
                        <Badge variant="success">Healthy</Badge>
                        All systems operating normally
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="warning">Degraded</Badge>
                        Some services experiencing issues
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="destructive">Unhealthy</Badge>
                        Critical systems are down
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
