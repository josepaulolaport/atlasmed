"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { canManageTerritories, canReadTerritories } from "@/lib/permissions";
import { territoriesApi } from "@/lib/api/territories";
import { TerritorySubnav } from "@/components/territory/territory-subnav";
import { ApprovalRequestsTable } from "@/components/territory/approval-requests-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { TerritoryApprovalRequest } from "@/types/territory";

export default function TerritoryApprovalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<TerritoryApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");

  const canRead = user ? canReadTerritories(user.role.name) : false;
  const canManage = user ? canManageTerritories(user.role.name) : false;

  const loadRequests = useCallback(async () => {
    if (!canManage) return;

    setLoading(true);
    try {
      const response = await territoriesApi.listApprovalRequests({
        status: statusFilter === "pending" ? "pending" : undefined,
        page: 1,
        limit: 50,
      });
      setRequests(response.items);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load approval requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [canManage, statusFilter]);

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
      return;
    }
    if (user && canRead && !canManage) {
      router.replace("/territories");
    }
  }, [user, canRead, canManage, router]);

  useEffect(() => {
    if (canManage) {
      void loadRequests();
    }
  }, [canManage, loadRequests]);

  if (!user || !canManage) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Territory approvals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and resolve pending territory structure changes
        </p>
      </div>

      <TerritorySubnav />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Approval queue</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={statusFilter === "pending" ? "default" : "outline"}
              onClick={() => setStatusFilter("pending")}
            >
              Pending
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <ApprovalRequestsTable requests={requests} onRefresh={loadRequests} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
