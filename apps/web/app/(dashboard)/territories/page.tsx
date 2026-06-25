"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  canCreateTerritories,
  canManageUsers,
  canManageTerritories,
  canReadTerritories,
  canUpdateTerritories,
  isAdmin,
} from "@/lib/permissions";
import { territoriesApi } from "@/lib/api/territories";
import { getApiErrorMessage } from "@/lib/api/errors";
import { TerritorySubnav } from "@/components/territory/territory-subnav";
import { TerritoryTree } from "@/components/territory/territory-tree";
import { TerritoryDetailPanel } from "@/components/territory/territory-detail-panel";
import { CreateTerritoryDialog } from "@/components/territory/create-territory-dialog";
import { ReparentTerritoryDialog } from "@/components/territory/reparent-territory-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import type { Territory, TerritoryTreeNode } from "@/types/territory";

function findTerritoryInTree(
  nodes: TerritoryTreeNode[],
  id: string
): Territory | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findTerritoryInTree(node.children, id);
    if (found) return found;
  }
  return null;
}

export default function TerritoriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSelection = searchParams.get("selected") ?? undefined;
  const [tree, setTree] = useState<TerritoryTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [reparentOpen, setReparentOpen] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const canRead = user ? canReadTerritories(user.role.name) : false;
  const canCreate = user ? canCreateTerritories(user.role.name) : false;
  const canUpdate = user ? canUpdateTerritories(user.role.name) : false;
  const canManage = user ? canManageTerritories(user.role.name) : false;
  const canAssignUsers = user ? canManageUsers(user.role.name) : false;
  const userIsAdmin = user ? isAdmin(user.role.name) : false;

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const response = await territoriesApi.listTerritories("tree");
      const nodes = response.data as TerritoryTreeNode[];
      setTree(nodes);
      setSelectedId((current) => current ?? requestedSelection ?? nodes[0]?.id);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load territories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [requestedSelection]);

  useEffect(() => {
    if (requestedSelection) {
      setSelectedId(requestedSelection);
    }
  }, [requestedSelection]);

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (canRead) {
      void loadTree();
    }
  }, [canRead, loadTree]);

  const selectedTerritory = selectedId ? findTerritoryInTree(tree, selectedId) : null;

  const handleRecompute = async () => {
    if (!confirm("Recompute clinic territory membership for all clinics?")) return;

    setRecomputing(true);
    try {
      const result = await territoriesApi.recomputeMembership();
      toast({
        title: "Membership recomputed",
        description: `Processed ${result.processed}, updated ${result.updated}`,
        variant: "success",
      });
      await loadTree();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to recompute membership"),
        variant: "destructive",
      });
    } finally {
      setRecomputing(false);
    }
  };

  if (!user || !canRead) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Territories</h1>
          <p className="mt-1 text-sm text-gray-500">
            Hierarchy is geo-linked from boundaries. Create territories with their polygon to
            establish parents automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadTree()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecompute}
              disabled={recomputing}
            >
              {recomputing ? "Recomputing..." : "Recompute membership"}
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create territory
            </Button>
          )}
        </div>
      </div>

      <TerritorySubnav />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hierarchy</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <TerritoryTree
                nodes={tree}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </CardContent>
        </Card>

        <TerritoryDetailPanel
          territory={selectedTerritory}
          canManage={canAssignUsers}
          canUpdate={canUpdate}
          isAdmin={userIsAdmin}
          onRefresh={loadTree}
          onReparent={() => setReparentOpen(true)}
        />
      </div>

      <CreateTerritoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        parentId={selectedId}
        isAdmin={userIsAdmin}
        onSuccess={loadTree}
      />

      <ReparentTerritoryDialog
        territory={selectedTerritory}
        open={reparentOpen}
        onOpenChange={setReparentOpen}
        isAdmin={userIsAdmin}
        onSuccess={loadTree}
      />
    </div>
  );
}
