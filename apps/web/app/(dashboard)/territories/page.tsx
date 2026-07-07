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
import { cn } from "@/lib/utils";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import type { Territory, TerritoryTreeNode } from "@/types/territory";

type TerritoryView = "grouping" | "manager-zones" | "rep-patches";

const VIEW_OPTIONS: Array<{ id: TerritoryView; label: string; description: string }> = [
  {
    id: "grouping",
    label: "Grouping",
    description: "Region, state, and municipality tree for filters and analytics.",
  },
  {
    id: "manager-zones",
    label: "Manager zones",
    description: "Flat manager assignment areas that contain rep patches.",
  },
  {
    id: "rep-patches",
    label: "Rep patches",
    description: "Operational territories where clinics are assigned.",
  },
];

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

function toFlatTreeNodes(territories: Territory[]): TerritoryTreeNode[] {
  return territories.map((territory) => ({
    ...territory,
    children: [],
  }));
}

export default function TerritoriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSelection = searchParams.get("selected") ?? undefined;
  const requestedView = searchParams.get("view") as TerritoryView | null;
  const [view, setView] = useState<TerritoryView>(
    requestedView && VIEW_OPTIONS.some((option) => option.id === requestedView)
      ? requestedView
      : "grouping"
  );
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
      let nodes: TerritoryTreeNode[] = [];

      if (view === "grouping") {
        const response = await territoriesApi.listGroupingTree();
        nodes = response.data;
      } else {
        const response = await territoriesApi.listTerritories("flat");
        const territories = response.data as Territory[];
        const filtered =
          view === "manager-zones"
            ? territories.filter((territory) => territory.territoryType.assignableToManagers)
            : territories.filter((territory) => territory.territoryType.assignsClinics);
        nodes = toFlatTreeNodes(filtered);
      }

      setTree(nodes);
      setSelectedId((current) => {
        if (current && nodes.some((node) => node.id === current)) {
          return current;
        }
        return requestedSelection ?? nodes[0]?.id;
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to load territories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [requestedSelection, view]);

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
  const activeView = VIEW_OPTIONS.find((option) => option.id === view)!;

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
            Manager zones and rep patches drive assignment scope. Grouping areas are used for
            filters and analytics only.
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

      <div className="mb-4 flex flex-wrap gap-2">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setView(option.id)}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-sm",
              view === option.id
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            )}
          >
            <span className="block font-medium">{option.label}</span>
            <span className="block text-xs text-gray-500">{option.description}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{activeView.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : tree.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No {activeView.label.toLowerCase()} found.
              </p>
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
        parentId={view === "grouping" ? selectedId : undefined}
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
