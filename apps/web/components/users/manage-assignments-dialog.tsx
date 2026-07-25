"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usersApi } from "@/lib/api/users";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  TerritoryPicker,
  useTerritoryLabels,
} from "@/components/territory/territory-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import type { User, UserAssignments } from "@/types/auth";
import { getTerritoryAssignmentPickerConfig } from "@/lib/territory/assignment-picker-config";

interface BusinessVertical {
  id: string;
  code: string;
  name: string;
}

interface ManageAssignmentsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageAssignmentsDialog({
  user,
  open,
  onOpenChange,
}: ManageAssignmentsDialogProps) {
  const [assignments, setAssignments] = useState<UserAssignments | null>(null);
  const [managers, setManagers] = useState<User[]>([]);
  const [allVerticals, setAllVerticals] = useState<BusinessVertical[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [selectedVerticalId, setSelectedVerticalId] = useState("");
  const [territoryBusy, setTerritoryBusy] = useState<string | null>(null);
  const [verticalBusy, setVerticalBusy] = useState<string | null>(null);
  const { getLabel } = useTerritoryLabels();

  const isTargetUser = user?.role.name === "REP";
  const isTargetManager = user?.role.name === "MANAGER";
  const canAssignTerritories = isTargetUser || isTargetManager;
  const territoryPickerConfig = user
    ? getTerritoryAssignmentPickerConfig(
        isTargetManager ? "MANAGER" : "REP"
      )
    : null;

  const assignedTerritories = useMemo(
    () =>
      assignments?.verticalAssignments.flatMap((vertical) => vertical.territories) ??
      [],
    [assignments]
  );

  const primaryVerticalAssignment = assignments?.verticalAssignments[0];
  const currentManagerId = primaryVerticalAssignment?.managerId ?? null;

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [assignmentsData, usersResponse, verticalsData] = await Promise.all([
        usersApi.getUserAssignments(user.id),
        usersApi.getUsers({ page: 1, limit: 100 }),
        usersApi.getVerticals(),
      ]);

      setAssignments(assignmentsData);
      setAllVerticals(verticalsData);
      setManagers(
        usersResponse.data.filter(
          (u) =>
            (u.role.name === "MANAGER" || u.role.name === "ADMIN") &&
            u.id !== user.id
        )
      );
    } catch {
      toast({
        title: "Error",
        description: "Falha ao carregar atribuições",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [user, onOpenChange]);

  useEffect(() => {
    if (open && user) {
      setSelectedTerritoryId("");
      setSelectedVerticalId("");
      loadData();
    } else {
      setAssignments(null);
    }
  }, [open, user, loadData]);

  const handleManagerChange = async (value: string) => {
    if (!user) return;

    const managerId = value === "none" ? null : value;
    setSavingManager(true);
    try {
      await usersApi.assignManager(user.id, managerId);
      await loadData();
      toast({
        title: "Success",
        description: managerId
          ? "Manager assigned successfully"
          : "Manager removed successfully",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to update manager"),
        variant: "destructive",
      });
    } finally {
      setSavingManager(false);
    }
  };

  const handleAddTerritory = async () => {
    if (!user || !selectedTerritoryId) return;

    setTerritoryBusy("add");
    try {
      await usersApi.assignTerritory(user.id, selectedTerritoryId);
      setSelectedTerritoryId("");
      await loadData();
      toast({
        title: "Success",
        description: "Territory assigned successfully",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to assign territory"),
        variant: "destructive",
      });
    } finally {
      setTerritoryBusy(null);
    }
  };

  const handleRevokeTerritory = async (territoryId: string) => {
    if (!user) return;

    setTerritoryBusy(territoryId);
    try {
      await usersApi.revokeTerritory(user.id, territoryId);
      await loadData();
      toast({
        title: "Success",
        description: "Territory revoked successfully",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to revoke territory"),
        variant: "destructive",
      });
    } finally {
      setTerritoryBusy(null);
    }
  };

  const handleAddVertical = async () => {
    if (!user || !selectedVerticalId) return;

    setVerticalBusy("add");
    try {
      await usersApi.assignVertical(user.id, selectedVerticalId);
      setSelectedVerticalId("");
      await loadData();
      toast({ title: "Vertical atribuída com sucesso", variant: "success" });
    } catch (err) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(err, "Falha ao atribuir vertical"),
        variant: "destructive",
      });
    } finally {
      setVerticalBusy(null);
    }
  };

  const handleRevokeVertical = async (verticalId: string) => {
    if (!user) return;

    setVerticalBusy(verticalId);
    try {
      await usersApi.revokeVertical(user.id, verticalId);
      await loadData();
      toast({ title: "Vertical removida com sucesso", variant: "success" });
    } catch (err) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(err, "Falha ao remover vertical"),
        variant: "destructive",
      });
    } finally {
      setVerticalBusy(null);
    }
  };

  const formatManagerLabel = (m: User) => {
    const name =
      m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.username;
    return `${name} (${m.email})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar atribuições</DialogTitle>
          <DialogDescription>
            {user
              ? `Escopo organizacional de ${user.username} (${user.email})`
              : "Carregando..."}
          </DialogDescription>
        </DialogHeader>

        {loading || !assignments || !user ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {isTargetUser && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status operacional:</span>
                {assignments.isOperationallyActive ? (
                  <Badge variant="success">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Não atribuído</Badge>
                )}
              </div>
            )}

            {isTargetUser && (
              <div className="space-y-2">
                <Label htmlFor="manager-select">Gerente</Label>
                <Select
                  value={currentManagerId ?? "none"}
                  onValueChange={handleManagerChange}
                  disabled={savingManager}
                >
                  <SelectTrigger id="manager-select">
                    <SelectValue placeholder="Selecione o gerente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {formatManagerLabel(manager)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {primaryVerticalAssignment?.managerName && (
                  <p className="text-xs text-gray-500">
                    Atual: {primaryVerticalAssignment.managerName}
                  </p>
                )}
              </div>
            )}

            {canAssignTerritories && territoryPickerConfig && (
              <div className="space-y-3">
                <Label>Territórios</Label>
                <p className="text-xs text-gray-500">{territoryPickerConfig.helperText}</p>
                {assignedTerritories.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum território atribuído. Selecione um território abaixo.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {assignedTerritories.map((territory) => (
                      <li
                        key={territory.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div>
                          <span className="text-sm font-medium">
                            {territory.name || getLabel(territory.id)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeTerritory(territory.id)}
                          disabled={territoryBusy !== null}
                          aria-label={`Remover ${territory.name || territory.id}`}
                        >
                          {territoryBusy === territory.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <TerritoryPicker
                  value={selectedTerritoryId}
                  onChange={setSelectedTerritoryId}
                  disabled={territoryBusy !== null}
                  pickerConfig={territoryPickerConfig}
                  placeholder="Selecione um território elegível"
                />
                <Button
                  onClick={handleAddTerritory}
                  disabled={territoryBusy !== null || !selectedTerritoryId}
                  className="w-full"
                >
                  {territoryBusy === "add" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Adicionar território"
                  )}
                </Button>
              </div>
            )}

            {canAssignTerritories && (
              <div className="space-y-3">
                <Label>Verticais</Label>
                <p className="text-xs text-gray-500">
                  Verticais determinam quais territórios este usuário pode visualizar.
                  Sem verticais atribuídas, todos os territórios são visíveis.
                </p>
                {assignments.verticalAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhuma vertical atribuída. Todos os territórios são visíveis.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {assignments.verticalAssignments.map((vertical) => (
                      <li
                        key={vertical.verticalId}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div>
                          <span className="text-sm font-medium">
                            {vertical.verticalName}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeVertical(vertical.verticalId)}
                          disabled={verticalBusy !== null}
                          aria-label={`Remover vertical ${vertical.verticalName}`}
                        >
                          {verticalBusy === vertical.verticalId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {allVerticals.length > 0 && (
                  <>
                    <Select
                      value={selectedVerticalId}
                      onValueChange={setSelectedVerticalId}
                      disabled={verticalBusy !== null}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma vertical" />
                      </SelectTrigger>
                      <SelectContent>
                        {allVerticals
                          .filter(
                            (vertical) =>
                              !assignments.verticalAssignments.some(
                                (assignment) =>
                                  assignment.verticalId === vertical.id
                              )
                          )
                          .map((vertical) => (
                            <SelectItem key={vertical.id} value={vertical.id}>
                              {vertical.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddVertical}
                      disabled={verticalBusy !== null || !selectedVerticalId}
                      className="w-full"
                    >
                      {verticalBusy === "add" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Adicionar vertical"
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
