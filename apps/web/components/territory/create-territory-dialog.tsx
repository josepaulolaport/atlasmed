"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TerritoryMapEditor } from "@/components/territory/map/territory-map-editor";
import { territoriesApi } from "@/lib/api/territories";
import { usersApi } from "@/lib/api/users";
import { getApiErrorMessage } from "@/lib/api/errors";
import { isValidGeoJsonPolygon, normalizeTerritoryBoundary, parseGeoJsonPolygon } from "@/lib/territory/geojson";
import { slugifyTerritoryIdentifier } from "@/lib/territory/territory-identifier";
import { toast } from "@/hooks/use-toast";
import { isApprovalRequest } from "@/components/territory/territory-utils";
import type { GeoJsonPolygon, TerritoryType } from "@/types/territory";

interface CreateTerritoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onSuccess: () => void;
}

export function CreateTerritoryDialog({
  open,
  onOpenChange,
  isAdmin,
  onSuccess,
}: CreateTerritoryDialogProps) {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [territoryTypeId, setTerritoryTypeId] = useState("");
  const [verticalId, setVerticalId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<TerritoryType[]>([]);
  const [verticals, setVerticals] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [boundaryMode, setBoundaryMode] = useState<"map" | "json">("map");
  const [boundaryDraft, setBoundaryDraft] = useState<GeoJsonPolygon | null>(null);
  const [boundaryJson, setBoundaryJson] = useState("");

  const selectedType = useMemo(
    () => types.find((type) => type.id === territoryTypeId),
    [types, territoryTypeId]
  );

  const requiresBoundary = selectedType?.canHaveBoundary ?? true;
  const isRepPatchType = selectedType?.slug === "patch";

  const loadFormData = useCallback(async () => {
    const [typesResponse, verticalList] = await Promise.all([
      territoriesApi.listTerritoryTypes(),
      usersApi.getVerticals(),
    ]);
    setTypes(typesResponse.data);
    setVerticals(verticalList);
    setTerritoryTypeId((current) => current || typesResponse.data[0]?.id || "");
    setVerticalId((current) => current || verticalList[0]?.id || "");
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadFormData();
  }, [open, loadFormData]);

  const resetForm = () => {
    setName("");
    setIdentifier("");
    setIdentifierTouched(false);
    setTerritoryTypeId(types[0]?.id ?? "");
    setVerticalId(verticals[0]?.id ?? "");
    setReason("");
    setBoundaryMode("map");
    setBoundaryDraft(null);
    setBoundaryJson("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForm();
    }
    onOpenChange(next);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!identifierTouched) {
      setIdentifier(slugifyTerritoryIdentifier(value));
    }
  };

  const resolveBoundary = (): GeoJsonPolygon | null => {
    if (!requiresBoundary) return null;
    if (boundaryMode === "json") {
      return parseGeoJsonPolygon(boundaryJson);
    }
    return normalizeTerritoryBoundary(boundaryDraft);
  };

  const handleSave = async () => {
    if (!name.trim() || !territoryTypeId || !identifier.trim() || !verticalId) {
      toast({
        title: "Validação",
        description: "Nome, tipo, vertical e identificador são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const boundary = resolveBoundary();
    if (requiresBoundary && !isValidGeoJsonPolygon(boundary)) {
      toast({
        title: "Validation",
        description: "Draw or paste a valid GeoJSON polygon before creating the territory",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await territoriesApi.createTerritory({
        name: name.trim(),
        slug: identifier.trim().toLowerCase(),
        verticalId,
        territoryTypeId,
        reason: reason.trim() || undefined,
        boundary: boundary ?? undefined,
      });

      if (isApprovalRequest(result)) {
        toast({
          title: "Submitted for approval",
          description: "Your territory creation request is pending admin review.",
          variant: "success",
        });
      } else {
        const resolution = result.boundaryResolution;
        if (resolution?.mode === "rep_patch") {
          toast({
            title: "Territory created",
            description: `Rep patch linked to manager zone ${resolution.managerTerritoryId}.`,
            variant: "success",
          });
        } else {
          toast({
            title: "Success",
            description: `Territory ${result.slug} created with boundary.`,
            variant: "success",
          });
        }
      }

      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to create territory"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Criar território</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <p className="text-sm text-gray-500">
            Zonas de gerente e áreas de representante são territórios planos. Uma área
            de representante é automaticamente vinculada à zona de gerente cujo limite a
            contém.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="territory-vertical">Vertical</Label>
              <Select value={verticalId} onValueChange={setVerticalId}>
                <SelectTrigger id="territory-vertical">
                  <SelectValue placeholder="Selecionar vertical" />
                </SelectTrigger>
                <SelectContent>
                  {verticals.map((vertical) => (
                    <SelectItem key={vertical.id} value={vertical.id}>
                      {vertical.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="territory-type">Tipo</Label>
              <Select value={territoryTypeId} onValueChange={setTerritoryTypeId}>
                <SelectTrigger id="territory-type">
                  <SelectValue placeholder="Selecionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedType?.description ? (
                <p className="mt-1 text-xs text-gray-500">{selectedType.description}</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="territory-identifier">Identificador</Label>
              <Input
                id="territory-identifier"
                value={identifier}
                onChange={(e) => {
                  setIdentifierTouched(true);
                  setIdentifier(e.target.value.toLowerCase());
                }}
                placeholder="sudeste"
              />
              <p className="mt-1 text-xs text-gray-500">
                ID único para este território (minúsculas, ex.: <code>sudeste</code>).
              </p>
            </div>

            <div>
              <Label htmlFor="territory-name">Nome de exibição</Label>
              <Input
                id="territory-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Sudeste"
              />
            </div>
          </div>

          {isRepPatchType && (
            <p className="text-xs text-gray-500">
              A zona de gerente desta área de representante será resolvida automaticamente
              a partir do limite desenhado abaixo.
            </p>
          )}

          {requiresBoundary ? (
            <div className="space-y-3">
              <div>
                <Label>Limite</Label>
                <p className="text-xs text-gray-500">
                  Obrigatório. Desenhe um ou mais polígonos no mapa ou cole um GeoJSON Polygon /
                  MultiPolygon.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={boundaryMode === "map" ? "default" : "outline"}
                  onClick={() => setBoundaryMode("map")}
                >
                  Mapa
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={boundaryMode === "json" ? "default" : "outline"}
                  onClick={() => setBoundaryMode("json")}
                >
                  GeoJSON
                </Button>
              </div>
              {boundaryMode === "map" ? (
                <TerritoryMapEditor value={boundaryDraft} onChange={setBoundaryDraft} />
              ) : (
                <textarea
                  className="min-h-[200px] w-full rounded-md border p-2 font-mono text-xs"
                  value={boundaryJson}
                  onChange={(e) => setBoundaryJson(e.target.value)}
                  placeholder='{"type":"MultiPolygon","coordinates":[...]}'
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Este tipo de território não usa limites geográficos.
            </p>
          )}

          {!isAdmin && (
            <div>
              <Label htmlFor="create-reason">Motivo (opcional)</Label>
              <Input
                id="create-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Criando..." : isAdmin ? "Criar território" : "Enviar para aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
