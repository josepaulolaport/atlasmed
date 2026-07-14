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
  if (status === "healthy") return <Badge variant="success">Saudável</Badge>;
  if (status === "degraded") return <Badge variant="warning">Degradado</Badge>;
  return <Badge variant="destructive">Instável</Badge>;
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
          title: "Erro",
          description: "Falha ao carregar status do sistema",
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
              Saúde do sistema
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Monitore o status e as métricas de desempenho do sistema
            </p>
            {health && (
              <p className="text-xs text-zinc-400 mt-1">
                Última atualização: {formatDateTime(health.timestamp)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {loading || !health ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Carregando…
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
                    Status geral
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
                      {health.status === "healthy"
                        ? "Todos os sistemas operando normalmente"
                        : health.status === "degraded"
                        ? "Alguns sistemas apresentando problemas"
                        : "Sistemas apresentando problemas críticos"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                    Banco de dados
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
                        Tempo de resposta: {health.checks.database.responseTime}ms
                      </p>
                    )}
                  </div>
                  <StatusIcon status={health.checks.database.status} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                    Cache Redis
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
                        Tempo de resposta: {health.checks.redis.responseTime}ms
                      </p>
                    )}
                  </div>
                  <StatusIcon status={health.checks.redis.status} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                    Uso de memória
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
                  Métricas da aplicação
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Usuários ativos
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
                        Atualmente online
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Sessões ativas
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
                        Total de sessões
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Taxa de sucesso de login
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
                        Logins bem-sucedidos
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                      <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                        Redefinições de senha
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
                      <p className="text-xs text-zinc-500 mt-1">Neste período</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
                <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                  Detalhes da verificação de saúde
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium text-zinc-900">
                      Intervalo de monitoramento
                    </h4>
                    <p className="text-zinc-500 mt-1">
                      O status de saúde é atualizado automaticamente a cada 30 segundos
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-zinc-900">
                      Definições de status
                    </h4>
                    <ul className="mt-2 space-y-2 text-zinc-500">
                      <li className="flex items-center gap-2">
                        <Badge variant="success">Saudável</Badge>
                        Todos os sistemas operando normalmente
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="warning">Degradado</Badge>
                        Alguns serviços apresentando problemas
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="destructive">Instável</Badge>
                        Sistemas críticos fora do ar
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
