"use client";

import { useState, useEffect } from "react";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@/types/auth";
import { formatDateTime } from "@/lib/utils";

const deviceIcons: Record<Session["deviceType"], string> = {
  DESKTOP: "solar:monitor-linear",
  MOBILE: "solar:smartphone-linear",
  TABLET: "solar:tablet-linear",
  UNKNOWN: "solar:question-circle-linear",
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await authApi.getSessions();
        setSessions(data);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load sessions",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("Tem certeza de que deseja revogar esta sessão?")) {
      return;
    }

    setRevokingId(sessionId);

    try {
      await authApi.revokeSession(sessionId);
      toast({
        title: "Success",
        description: "Session revoked successfully",
        variant: "success",
      });

      const data = await authApi.getSessions();
      setSessions(data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to revoke session",
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              Sessões ativas
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Gerencie suas sessões ativas e a segurança
            </p>
          </div>
          {sessions.some((session) => !session.isCurrent) && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm("Sair de todos os outros dispositivos?")) {
                  return;
                }

                try {
                  const result = await authApi.revokeOtherSessions();
                  toast({
                    title: "Success",
                    description:
                      result.revokedCount > 0
                        ? `Signed out of ${result.revokedCount} other device(s)`
                        : "No other active sessions found",
                    variant: "success",
                  });
                  const data = await authApi.getSessions();
                  setSessions(data);
                } catch {
                  toast({
                    title: "Error",
                    description: "Failed to sign out other devices",
                    variant: "destructive",
                  });
                }
              }}
            >
              Sair dos outros dispositivos
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Carregando…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <iconify-icon
                icon="solar:question-circle-linear"
                stroke-width="1.5"
                className="text-2xl"
              />
            </div>
            <p className="text-sm text-zinc-500">Nenhuma sessão ativa encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const deviceIcon = deviceIcons[session.deviceType];
              return (
                <div
                  key={session.id}
                  className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                    session.isCurrent
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-zinc-200"
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                          <iconify-icon
                            icon={deviceIcon}
                            stroke-width="1.5"
                            className="text-xl"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900 tracking-tight">
                              {session.browserName || "Navegador desconhecido"}
                            </span>
                            {session.isCurrent && (
                              <Badge variant="success">Atual</Badge>
                            )}
                            {session.suspiciousActivity && (
                              <Badge variant="destructive">
                                <iconify-icon
                                  icon="solar:danger-triangle-linear"
                                  stroke-width="1.5"
                                  className="text-xs mr-1"
                                />
                                Suspeita
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-zinc-500">
                            {session.browserVersion && (
                              <p>Versão: {session.browserVersion}</p>
                            )}
                            {session.osName && <p>SO: {session.osName}</p>}
                            <p className="flex items-center gap-1">
                              <iconify-icon
                                icon="solar:map-point-linear"
                                stroke-width="1.5"
                                className="text-sm"
                              />
                              {session.ipAddress || "Local desconhecido"}
                            </p>
                            <p className="flex items-center gap-1">
                              <iconify-icon
                                icon="solar:clock-circle-linear"
                                stroke-width="1.5"
                                className="text-sm"
                              />
                              Última atividade: {formatDateTime(session.lastSeenAt)}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Criada em: {formatDateTime(session.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revokingId === session.id}
                        >
                          <iconify-icon
                            icon="solar:trash-bin-trash-linear"
                            stroke-width="1.5"
                            className="text-base"
                          />
                          {revokingId === session.id ? "Revogando..." : "Revogar"}
                        </Button>
                      )}
                    </div>
                    {session.suspiciousActivity && (
                      <div className="mt-4 rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                        <p className="flex items-center gap-2">
                          <iconify-icon
                            icon="solar:danger-triangle-linear"
                            stroke-width="1.5"
                            className="text-base"
                          />
                          Esta sessão foi sinalizada por atividade suspeita.
                          Se não foi você, revogue-a imediatamente e altere
                          sua senha.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
            <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
              Dicas de segurança
            </h3>
          </div>
          <div className="p-5">
            <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-600">
              <li>Sempre saia ao usar computadores públicos ou compartilhados</li>
              <li>
                Revise regularmente suas sessões ativas em busca de dispositivos
                não reconhecidos
              </li>
              <li>
                Se notar atividade suspeita, revogue a sessão e altere sua senha
                imediatamente
              </li>
              <li>Ative a verificação de email e telefone para mais segurança</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
