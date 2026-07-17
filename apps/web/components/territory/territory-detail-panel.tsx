"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { territoriesApi } from "@/lib/api/territories";
import { getApiErrorMessage } from "@/lib/api/errors";
import { toast } from "@/hooks/use-toast";
import { TerritoryBoundarySection } from "@/components/territory/territory-boundary-section";
import { AssignUserToTerritoryDialog } from "@/components/territory/assign-user-to-territory-dialog";
import { isApprovalRequest } from "@/components/territory/territory-utils";
import type { Territory } from "@/types/territory";
import { formatDateTime } from "@/lib/utils";

interface TerritoryDetailPanelProps {
  territory: Territory | null;
  canManage: boolean;
  canUpdate: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
}

export function TerritoryDetailPanel({
  territory,
  canManage,
  canUpdate,
  isAdmin,
  onRefresh,
}: TerritoryDetailPanelProps) {
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (territory) {
      setEditName(territory.name);
    }
  }, [territory]);

  if (!territory) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-64 items-center justify-center text-sm text-gray-500">
          Selecione um território na lista para ver os detalhes.
        </CardContent>
      </Card>
    );
  }

  const handleSaveName = async () => {
    if (!editName.trim() || editName === territory.name) return;

    setSavingName(true);
    try {
      const result = await territoriesApi.updateTerritory(territory.id, {
        name: editName.trim(),
      });
      if (isApprovalRequest(result)) {
        toast({
          title: "Submitted for approval",
          description: "Name change request is pending review.",
          variant: "success",
        });
      } else {
        toast({ title: "Success", description: "Territory updated", variant: "success" });
      }
      onRefresh();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to update territory"),
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(`Desativar território ${territory.code}?`)) return;

    setDeactivating(true);
    try {
      if (isAdmin) {
        await territoriesApi.deactivateTerritory(territory.id);
        toast({ title: "Success", description: "Territory deactivated", variant: "success" });
      } else {
        const result = await territoriesApi.updateTerritory(territory.id, {
          isActive: false,
        });
        if (isApprovalRequest(result)) {
          toast({
            title: "Submitted for approval",
            description: "Deactivation request is pending review.",
            variant: "success",
          });
        }
      }
      onRefresh();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to deactivate territory"),
        variant: "destructive",
      });
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>{territory.name}</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                <span className="font-medium">{territory.slug}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="secondary">
                  {territory.territoryType.name}
                </Badge>
                {territory.hasBoundary && <Badge variant="outline">com limite</Badge>}
                {territory.managerTerritoryId && (
                  <Badge variant="outline">zona de gestor vinculada</Badge>
                )}
                {typeof territory.repPatchCount === "number" && territory.repPatchCount > 0 && (
                  <Badge variant="outline">{territory.repPatchCount} áreas de representante</Badge>
                )}
                {!territory.isActive && <Badge variant="destructive">inativo</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  Atribuir usuário
                </Button>
              )}
              {canUpdate && territory.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                >
                  {deactivating ? "Desativando..." : "Desativar"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <span className="text-gray-500">Identificador:</span> {territory.slug}
            </div>
            <div>
              <span className="text-gray-500">Clínicas:</span> {territory.clinicCount}
            </div>
            <div>
              <span className="text-gray-500">Usuários atribuídos:</span>{" "}
              {territory.assignedUserCount}
            </div>
            {territory.managerTerritoryId && (
              <div>
                <span className="text-gray-500">Zona de gestor:</span>{" "}
                {territory.managerTerritoryId}
              </div>
            )}
            <div>
              <span className="text-gray-500">Criado:</span>{" "}
              {formatDateTime(territory.createdAt)}
            </div>
            <div>
              <span className="text-gray-500">Atualizado:</span>{" "}
              {formatDateTime(territory.updatedAt)}
            </div>
          </div>

          {canUpdate && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="territory-edit-name">Nome</Label>
                <Input
                  id="territory-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSaveName}
                disabled={savingName || editName.trim() === territory.name}
              >
                {savingName ? "Salvando..." : "Salvar nome"}
              </Button>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Limite</h3>
            <TerritoryBoundarySection
              territory={territory}
              canEdit={canUpdate}
              onUpdated={onRefresh}
            />
          </div>
        </CardContent>
      </Card>

      <AssignUserToTerritoryDialog
        territory={territory}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onSuccess={onRefresh}
      />
    </>
  );
}
