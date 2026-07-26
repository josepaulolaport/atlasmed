"use client";

import { useState, useEffect } from "react";
import { territoriesApi } from "@/lib/api/territories";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Plus, Search, Map, List } from "lucide-react";
import type { Territory } from "@/types/territory";
import { CreateTerritoryDialog } from "./create-territory-dialog";

interface TerritorySelectorProps {
  value?: string;
  onChange: (territoryId: string | undefined) => void;
  territoryType: "manager_zone" | "patch";
  managerTerritoryId?: string;
  verticalId?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export function TerritorySelector({
  value,
  onChange,
  territoryType,
  managerTerritoryId,
  verticalId,
  disabled = false,
  error,
  required = false,
}: TerritorySelectorProps) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const isRepPatch = territoryType === "patch";
  const label = isRepPatch
    ? "Território do Representante (Patch)"
    : "Território do Gerente (Zona)";

  const helperText = isRepPatch
    ? "Selecione um território patch dentro da zona do gerente"
    : "Selecione uma zona de gerente para atribuir";

  useEffect(() => {
    const fetchTerritories = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let data: Territory[];
        if (isRepPatch) {
          const response = await territoriesApi.listRepPatches(
            managerTerritoryId,
            verticalId,
          );
          data = response.data;
        } else {
          const response = await territoriesApi.listManagerZones(verticalId);
          data = response.data;
        }
        setTerritories(data);
      } catch (err) {
        setLoadError("Falha ao carregar territórios");
        console.error("Failed to fetch territories:", err);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if not disabled, or if patch and has manager territory
    if (!disabled && (!isRepPatch || managerTerritoryId)) {
      fetchTerritories();
    } else if (isRepPatch && !managerTerritoryId) {
      setTerritories([]);
      setLoading(false);
    }
  }, [territoryType, managerTerritoryId, verticalId, disabled, isRepPatch]);

  const filteredTerritories = territories.filter((territory) =>
    territory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    territory.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTerritory = territories.find((t) => t.id === value);

  const handleTerritoryCreated = (territory: Territory) => {
    setTerritories((prev) => [territory, ...prev]);
    onChange(territory.id);
  };

  const handleSelect = (territoryId: string) => {
    if (value === territoryId) {
      onChange(undefined); // Deselect if clicking again
    } else {
      onChange(territoryId);
    }
  };

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-600">*</span>}
      </Label>

      {isRepPatch && !managerTerritoryId && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          <p>Selecione um gerente primeiro para ver os territórios disponíveis</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando territórios...</span>
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          <p>{loadError}</p>
        </div>
      ) : (
        <>
          <Tabs defaultValue="list" className="w-full">
            <div className="flex items-center justify-between mb-2">
              <TabsList>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Mapa
                </TabsTrigger>
              </TabsList>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                disabled={disabled}
              >
                <Plus className="h-4 w-4 mr-1" />
                Criar Novo
              </Button>
            </div>

            <TabsContent value="list" className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar território..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={disabled}
                />
              </div>

              {filteredTerritories.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center">
                  <p className="text-sm text-gray-500">
                    {searchQuery
                      ? "Nenhum território encontrado"
                      : territories.length === 0
                      ? "Nenhum território disponível. Crie um novo território para continuar."
                      : "Nenhum território corresponde à sua busca"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTerritories.map((territory) => {
                        const isSelected = value === territory.id;
                        return (
                          <TableRow
                            key={territory.id}
                            className={isSelected ? "bg-blue-50" : ""}
                          >
                            <TableCell className="font-medium">
                              {territory.name}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs">{territory.code}</code>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  territory.isActive ? "default" : "secondary"
                                }
                              >
                                {territory.isActive ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleSelect(territory.id)}
                                disabled={disabled}
                              >
                                {isSelected ? "Selecionado" : "Selecionar"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="map" className="space-y-3">
              <div className="rounded-md border border-dashed p-12 text-center">
                <Map className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-500 mb-2">
                  Visualização de mapa
                </p>
                <p className="text-xs text-gray-400">
                  A visualização de mapa com limites de território será implementada aqui.
                  Use a visualização de lista para selecionar territórios por enquanto.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {selectedTerritory && (
            <div className="rounded-md bg-blue-50 p-3 text-sm">
              <p className="font-medium text-blue-900">Território Selecionado:</p>
              <p className="text-blue-700">
                {selectedTerritory.name} ({selectedTerritory.code})
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <p className="text-xs text-gray-500">{helperText}</p>
        </>
      )}

      <CreateTerritoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        territoryType={territoryType}
        verticalId={verticalId}
        onTerritoryCreated={handleTerritoryCreated}
      />
    </div>
  );
}
