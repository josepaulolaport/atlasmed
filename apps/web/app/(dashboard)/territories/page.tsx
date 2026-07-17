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
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Territory } from "@/types/territory";

type TerritoryView = "manager-zones" | "rep-patches";

const VIEW_OPTIONS: Array<{ id: TerritoryView; label: string; description: string }> = [
  {
    id: "manager-zones",
    label: "Zonas de gerente",
    description: "Áreas planas de atribuição de gerente que contêm áreas de representante.",
  },
  {
    id: "rep-patches",
    label: "Áreas de representante",
    description: "Territórios operacionais onde as clínicas são atribuídas.",
  },
];

export default function TerritoriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSelection = searchParams.get("selected") ?? undefined;
  const requestedView = searchParams.get("view") as TerritoryView | null;
  const [view, setView] = useState<TerritoryView>(
    requestedView && VIEW_OPTIONS.some((option) => option.id === requestedView)
      ? requestedView
      : "manager-zones"
  );
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const canRead = user ? canReadTerritories(user.role.name) : false;
  const canCreate = user ? canCreateTerritories(user.role.name) : false;
  const canUpdate = user ? canUpdateTerritories(user.role.name) : false;
  const canManage = user ? canManageTerritories(user.role.name) : false;
  const canAssignUsers = user ? canManageUsers(user.role.name) : false;
  const userIsAdmin = user ? isAdmin(user.role.name) : false;

  const loadTerritories = useCallback(async () => {
    setLoading(true);
    try {
      const typeSlug = view === "manager-zones" ? "manager_zone" : "patch";
      const response = await territoriesApi.listTerritories(typeSlug);
      const list = response.data;

      setTerritories(list);
      setSelectedId((current) => {
        if (current && list.some((territory) => territory.id === current)) {
          return current;
        }
        return requestedSelection ?? list[0]?.id;
      });
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao carregar territórios",
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
      void loadTerritories();
    }
  }, [canRead, loadTerritories]);

  const selectedTerritory = territories.find((t) => t.id === selectedId) ?? null;
  const activeView = VIEW_OPTIONS.find((option) => option.id === view)!;

  const handleRecompute = async () => {
    if (!confirm("Recalcular a associação de território das clínicas para todas as clínicas?")) return;

    setRecomputing(true);
    try {
      const result = await territoriesApi.recomputeMembership();
      toast({
        title: "Membership recomputed",
        description: `Processed ${result.processed}, updated ${result.updated}`,
        variant: "success",
      });
      await loadTerritories();
    } catch (err) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(err, "Falha ao reprocessar atribuições"),
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
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              Territórios
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Zonas de gerente e áreas de representante definem o escopo de
              atribuição das clínicas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => loadTerritories()}>
              <iconify-icon
                icon="solar:refresh-linear"
                stroke-width="1.5"
                className="text-base"
              />
              Atualizar
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecompute}
                disabled={recomputing}
              >
                {recomputing ? "Recalculando..." : "Recalcular associação"}
              </Button>
            )}
            {canCreate && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <iconify-icon
                  icon="solar:add-circle-linear"
                  stroke-width="1.5"
                  className="text-base"
                />
                Criar território
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full">
        <TerritorySubnav />

        <div className="mb-4 mt-4 flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                view === option.id
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              )}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-zinc-500">
                {option.description}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                {activeView.label}
              </h3>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="py-10 text-center text-sm text-zinc-500">
                  Carregando…
                </div>
              ) : territories.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">
                  Nenhum registro encontrado para {activeView.label.toLowerCase()}.
                </p>
              ) : (
                <TerritoryTree
                  nodes={territories}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </div>
          </div>

          <TerritoryDetailPanel
            territory={selectedTerritory}
            canManage={canAssignUsers}
            canUpdate={canUpdate}
            isAdmin={userIsAdmin}
            onRefresh={loadTerritories}
          />
        </div>
      </div>

      <CreateTerritoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isAdmin={userIsAdmin}
        onSuccess={loadTerritories}
      />
    </>
  );
}
