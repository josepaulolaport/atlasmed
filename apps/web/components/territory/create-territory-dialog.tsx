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
import { TerritoryPicker } from "@/components/territory/territory-picker";
import { TerritoryMapEditor } from "@/components/territory/map/territory-map-editor";
import { territoriesApi } from "@/lib/api/territories";
import { getApiErrorMessage } from "@/lib/api/errors";
import { isValidGeoJsonPolygon, normalizeTerritoryBoundary, parseGeoJsonPolygon } from "@/lib/territory/geojson";
import {
  formatCountryCode,
  isIsoCountryCode,
  slugifyTerritoryIdentifier,
} from "@/lib/territory/territory-identifier";
import { toast } from "@/hooks/use-toast";
import { isApprovalRequest } from "@/components/territory/territory-utils";
import type { GeoJsonPolygon, Territory, TerritoryType } from "@/types/territory";

interface CreateTerritoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string;
  isAdmin: boolean;
  onSuccess: () => void;
}

export function CreateTerritoryDialog({
  open,
  onOpenChange,
  parentId,
  isAdmin,
  onSuccess,
}: CreateTerritoryDialogProps) {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [marketCountryCode, setMarketCountryCode] = useState("BR");
  const [territoryTypeId, setTerritoryTypeId] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(parentId ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<TerritoryType[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [boundaryMode, setBoundaryMode] = useState<"map" | "json">("map");
  const [boundaryDraft, setBoundaryDraft] = useState<GeoJsonPolygon | null>(null);
  const [boundaryJson, setBoundaryJson] = useState("");

  const selectedType = useMemo(
    () => types.find((type) => type.id === territoryTypeId),
    [types, territoryTypeId]
  );

  const requiresBoundary = selectedType?.canHaveBoundary ?? true;
  const isCountryType = selectedType?.isCountryLevel ?? false;

  const countryMarkets = useMemo(
    () => territories.filter((territory) => territory.territoryType.isCountryLevel),
    [territories]
  );

  const selectedParent = useMemo(
    () => territories.find((territory) => territory.id === selectedParentId),
    [territories, selectedParentId]
  );

  const effectiveMarketCountryCode = useMemo(() => {
    if (isCountryType) {
      return formatCountryCode(marketCountryCode);
    }
    if (selectedParent?.countryCode) {
      return selectedParent.countryCode;
    }
    return formatCountryCode(marketCountryCode);
  }, [isCountryType, marketCountryCode, selectedParent?.countryCode]);

  const loadFormData = useCallback(async () => {
    const [typesResponse, territoriesResponse] = await Promise.all([
      territoriesApi.listTerritoryTypes(),
      territoriesApi.listTerritories("flat"),
    ]);
    setTypes(typesResponse.data);
    setTerritories(territoriesResponse.data as Territory[]);
    setTerritoryTypeId((current) => current || typesResponse.data[0]?.id || "");

    const countries = (territoriesResponse.data as Territory[]).filter(
      (territory) => territory.territoryType.isCountryLevel
    );
    if (countries[0]?.countryCode) {
      setMarketCountryCode(countries[0].countryCode);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadFormData();
  }, [open, loadFormData]);

  useEffect(() => {
    if (!open || !parentId) return;
    setSelectedParentId(parentId);
  }, [open, parentId]);

  const resetForm = () => {
    setName("");
    setIdentifier("");
    setIdentifierTouched(false);
    setMarketCountryCode(countryMarkets[0]?.countryCode ?? "BR");
    setTerritoryTypeId(types[0]?.id ?? "");
    setSelectedParentId(parentId ?? "");
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
    if (!isCountryType && !identifierTouched) {
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
    if (!name.trim() || !territoryTypeId) {
      toast({
        title: "Validation",
        description: "Name and type are required",
        variant: "destructive",
      });
      return;
    }

    if (isCountryType) {
      if (!isIsoCountryCode(marketCountryCode)) {
        toast({
          title: "Validation",
          description: "Enter a valid two-letter ISO country code (e.g. BR)",
          variant: "destructive",
        });
        return;
      }
    } else if (!identifier.trim()) {
      toast({
        title: "Validation",
        description: "Territory identifier is required",
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
        slug: isCountryType
          ? formatCountryCode(marketCountryCode).toLowerCase()
          : identifier.trim().toLowerCase(),
        territoryTypeId,
        countryCode: effectiveMarketCountryCode,
        parentId: isCountryType ? undefined : selectedParentId || undefined,
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
        if (resolution?.mode === "operational") {
          toast({
            title: "Territory created",
            description: `Boundary indexed across ${resolution.membershipCount} reference region(s).`,
            variant: "success",
          });
        } else if (resolution?.mode === "reference" && resolution.parentAssignmentStatus === "ambiguous") {
          toast({
            title: "Territory created — review parent",
            description:
              "The boundary overlaps multiple parents. Resolve it from the ambiguous parents queue.",
            variant: "destructive",
          });
        } else if (resolution?.mode === "reference" && resolution.rollupAncestorIds.length > 0) {
          toast({
            title: "Territory created",
            description: `Geo-linked to parent with ${resolution.rollupAncestorIds.length} secondary rollup link(s).`,
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
          <DialogTitle>Create territory</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <p className="text-sm text-gray-500">
            A <strong>market</strong> is the country this territory belongs to. An{" "}
            <strong>identifier</strong> is its unique ID in the system. Parent hierarchy comes
            from the boundary overlap.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="territory-type">Type</Label>
              <Select value={territoryTypeId} onValueChange={setTerritoryTypeId}>
                <SelectTrigger id="territory-type">
                  <SelectValue placeholder="Select type" />
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

            {isCountryType ? (
              <div className="md:col-span-2">
                <Label htmlFor="country-iso">Country (ISO code)</Label>
                <Input
                  id="country-iso"
                  value={marketCountryCode}
                  onChange={(e) => setMarketCountryCode(formatCountryCode(e.target.value))}
                  maxLength={2}
                  placeholder="BR"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Creates the top-level country territory. Its identifier will be{" "}
                  <code>{formatCountryCode(marketCountryCode).toLowerCase() || "br"}</code>.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="market-country">Market (country)</Label>
                  {selectedParent ? (
                    <p className="mt-2 rounded-md border bg-gray-50 px-3 py-2 text-sm">
                      {selectedParent.countryCode ?? effectiveMarketCountryCode} — inherited from
                      parent <span className="font-medium">{selectedParent.name}</span>
                    </p>
                  ) : countryMarkets.length > 0 ? (
                    <Select
                      value={effectiveMarketCountryCode}
                      onValueChange={setMarketCountryCode}
                    >
                      <SelectTrigger id="market-country">
                        <SelectValue placeholder="Select country market" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryMarkets.map((country) => (
                          <SelectItem
                            key={country.id}
                            value={country.countryCode ?? country.slug.toUpperCase()}
                          >
                            {country.countryCode} — {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="market-country"
                      value={marketCountryCode}
                      onChange={(e) => setMarketCountryCode(formatCountryCode(e.target.value))}
                      maxLength={2}
                      placeholder="BR"
                    />
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Geo-linking only considers territories in the same market.
                  </p>
                </div>
                <div>
                  <Label htmlFor="territory-identifier">Identifier</Label>
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
                    Unique ID for this territory (lowercase, e.g. <code>sudeste</code>).
                  </p>
                </div>
              </>
            )}

            <div className={isCountryType ? "md:col-span-2" : "md:col-span-2"}>
              <Label htmlFor="territory-name">Display name</Label>
              <Input
                id="territory-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={isCountryType ? "Brazil" : "Sudeste"}
              />
            </div>
          </div>

          {!isCountryType && (
            <div>
              <Label>Parent territory (optional)</Label>
              <TerritoryPicker
                value={selectedParentId}
                onChange={setSelectedParentId}
                placeholder="Geo-linking will set the parent from the boundary"
              />
            </div>
          )}

          {requiresBoundary ? (
            <div className="space-y-3">
              <div>
                <Label>Boundary</Label>
                <p className="text-xs text-gray-500">
                  Required. Draw one or more polygons on the map, or paste GeoJSON Polygon /
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
                  Map
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
              This territory type does not use geographic boundaries.
            </p>
          )}

          {!isAdmin && (
            <div>
              <Label htmlFor="create-reason">Reason (optional)</Label>
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
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Creating..." : isAdmin ? "Create territory" : "Submit for approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
