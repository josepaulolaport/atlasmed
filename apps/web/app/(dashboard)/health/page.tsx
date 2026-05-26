"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { healthApi } from "@/lib/api/health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  Database,
  Server,
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import type { HealthStatus } from "@/types/api";
import { canViewHealth } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";

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

  if (loading || !health) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  const statusIcon = {
    healthy: <CheckCircle2 className="h-6 w-6 text-green-600" />,
    degraded: <AlertTriangle className="h-6 w-6 text-yellow-600" />,
    unhealthy: <XCircle className="h-6 w-6 text-red-600" />,
  };

  const statusBadge = {
    healthy: <Badge variant="success">Healthy</Badge>,
    degraded: <Badge variant="warning">Degraded</Badge>,
    unhealthy: <Badge variant="destructive">Unhealthy</Badge>,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <p className="mt-2 text-gray-600">
          Monitor system status and performance metrics
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Last updated: {formatDateTime(health.timestamp)}
        </p>
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Overall Status
              </span>
              {statusBadge[health.status]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {statusIcon[health.status]}
              <div>
                <p className="text-lg font-semibold capitalize">
                  {health.status}
                </p>
                <p className="text-sm text-gray-600">
                  All systems are{" "}
                  {health.status === "healthy"
                    ? "operating normally"
                    : health.status === "degraded"
                    ? "experiencing some issues"
                    : "experiencing critical issues"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {statusBadge[health.checks.database.status]}
                {health.checks.database.responseTime && (
                  <p className="mt-2 text-xs text-gray-500">
                    Response time: {health.checks.database.responseTime}ms
                  </p>
                )}
              </div>
              {statusIcon[health.checks.database.status]}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis Cache</CardTitle>
            <Server className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {statusBadge[health.checks.redis.status]}
                {health.checks.redis.responseTime && (
                  <p className="mt-2 text-xs text-gray-500">
                    Response time: {health.checks.redis.responseTime}ms
                  </p>
                )}
              </div>
              {statusIcon[health.checks.redis.status]}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div>
              <div className="text-2xl font-bold">
                {health.checks.memory.percentage.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500">
                {(health.checks.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB /{" "}
                {(health.checks.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full ${
                    health.checks.memory.percentage > 80
                      ? "bg-red-600"
                      : health.checks.memory.percentage > 60
                      ? "bg-yellow-500"
                      : "bg-green-600"
                  }`}
                  style={{ width: `${health.checks.memory.percentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {health.metrics && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Application Metrics
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Users
                </CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {health.metrics.activeUsers}
                </div>
                <p className="text-xs text-gray-500">Currently online</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Sessions
                </CardTitle>
                <Shield className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {health.metrics.activeSessions}
                </div>
                <p className="text-xs text-gray-500">Total sessions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Login Success Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(health.metrics.loginSuccessRate * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500">Successful logins</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Password Resets
                </CardTitle>
                <Activity className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {health.metrics.passwordResets}
                </div>
                <p className="text-xs text-gray-500">This period</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Health Check Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900">Monitoring Interval</h4>
              <p className="text-gray-600">
                Health status is automatically refreshed every 30 seconds
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Status Definitions</h4>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li>
                  <Badge variant="success" className="mr-2">
                    Healthy
                  </Badge>
                  All systems operating normally
                </li>
                <li>
                  <Badge variant="warning" className="mr-2">
                    Degraded
                  </Badge>
                  Some services experiencing issues
                </li>
                <li>
                  <Badge variant="destructive" className="mr-2">
                    Unhealthy
                  </Badge>
                  Critical systems are down
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
