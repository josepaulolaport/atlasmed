"use client";

import { useState, useEffect } from "react";
import { authApi } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Monitor,
  Smartphone,
  Tablet,
  HelpCircle,
  MapPin,
  Clock,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import type { Session } from "@/types/auth";
import { formatDateTime } from "@/lib/utils";

const deviceIcons = {
  DESKTOP: Monitor,
  MOBILE: Smartphone,
  TABLET: Tablet,
  UNKNOWN: HelpCircle,
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Active Sessions</h1>
          <p className="mt-2 text-gray-600">
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

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HelpCircle className="h-12 w-12 text-gray-400" />
            <p className="mt-4 text-center text-gray-600">
              No active sessions found
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const DeviceIcon = deviceIcons[session.deviceType];
            return (
              <Card
                key={session.id}
                className={session.isCurrent ? "border-blue-600 border-2" : ""}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-blue-100 p-3">
                        <DeviceIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {session.browserName || "Unknown Browser"}
                          {session.isCurrent && (
                            <Badge variant="success">Current</Badge>
                          )}
                          {session.suspiciousActivity && (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Suspicious
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          {session.browserVersion && (
                            <p>Version: {session.browserVersion}</p>
                          )}
                          {session.osName && <p>OS: {session.osName}</p>}
                          <p className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.ipAddress || "Unknown location"}
                          </p>
                          <p className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last active: {formatDateTime(session.lastSeenAt)}
                          </p>
                          <p className="text-xs text-gray-500">
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
                        <Trash2 className="mr-2 h-4 w-4" />
                        {revokingId === session.id ? "Revoking..." : "Revoke"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {session.suspiciousActivity && (
                  <CardContent>
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                      <p className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        This session has been flagged for suspicious activity.
                        If this was not you, revoke it immediately and change
                        your password.
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Security Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600">
            <li>
              Always log out when using public or shared computers
            </li>
            <li>
              Regularly review your active sessions for any unrecognized devices
            </li>
            <li>
              If you see suspicious activity, revoke the session and change your
              password immediately
            </li>
            <li>
              Enable email and phone verification for enhanced security
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
