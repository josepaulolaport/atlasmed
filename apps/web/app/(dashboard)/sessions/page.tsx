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
    if (!confirm("Are you sure you want to revoke this session?")) {
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
              Active Sessions
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Manage your active sessions and security
            </p>
          </div>
          {sessions.some((session) => !session.isCurrent) && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm("Sign out of all other devices?")) {
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
              Sign out other devices
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Loading…
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
            <p className="text-sm text-zinc-500">No active sessions found</p>
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
                              {session.browserName || "Unknown browser"}
                            </span>
                            {session.isCurrent && (
                              <Badge variant="success">Current</Badge>
                            )}
                            {session.suspiciousActivity && (
                              <Badge variant="destructive">
                                <iconify-icon
                                  icon="solar:danger-triangle-linear"
                                  stroke-width="1.5"
                                  className="text-xs mr-1"
                                />
                                Suspicious
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-zinc-500">
                            {session.browserVersion && (
                              <p>Version: {session.browserVersion}</p>
                            )}
                            {session.osName && <p>OS: {session.osName}</p>}
                            <p className="flex items-center gap-1">
                              <iconify-icon
                                icon="solar:map-point-linear"
                                stroke-width="1.5"
                                className="text-sm"
                              />
                              {session.ipAddress || "Unknown location"}
                            </p>
                            <p className="flex items-center gap-1">
                              <iconify-icon
                                icon="solar:clock-circle-linear"
                                stroke-width="1.5"
                                className="text-sm"
                              />
                              Last active: {formatDateTime(session.lastSeenAt)}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Created: {formatDateTime(session.createdAt)}
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
                          {revokingId === session.id ? "Revoking..." : "Revoke"}
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
                          This session has been flagged for suspicious activity.
                          If this was not you, revoke it immediately and change
                          your password.
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
              Security Tips
            </h3>
          </div>
          <div className="p-5">
            <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-600">
              <li>Always log out when using public or shared computers</li>
              <li>
                Regularly review your active sessions for any unrecognized
                devices
              </li>
              <li>
                If you see suspicious activity, revoke the session and change
                your password immediately
              </li>
              <li>Enable email and phone verification for enhanced security</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
