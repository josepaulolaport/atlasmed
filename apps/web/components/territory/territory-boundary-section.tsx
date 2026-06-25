"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { territoriesApi } from "@/lib/api/territories";
import { getApiErrorMessage } from "@/lib/api/errors";
import { toast } from "@/hooks/use-toast";
import { TerritoryMapEditor } from "@/components/territory/map/territory-map-editor";
import {
  normalizeTerritoryBoundary,
  parseGeoJsonPolygon,
  polygonCount,
} from "@/lib/territory/geojson";
import type { GeoJsonPolygon, Territory } from "@/types/territory";
import { Loader2 } from "lucide-react";

interface TerritoryBoundarySectionProps {
  territory: Territory;
  canEdit: boolean;
  onUpdated: () => void;
}

export function TerritoryBoundarySection({
  territory,
  canEdit,
  onUpdated,
}: TerritoryBoundarySectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [boundary, setBoundary] = useState<GeoJsonPolygon | null>(null);
  const [draft, setDraft] = useState<GeoJsonPolygon | null>(null);
  const [geoJsonText, setGeoJsonText] = useState("");
  const [mode, setMode] = useState<"map" | "json">("map");

  const canHaveBoundary = territory.territoryType.canHaveBoundary;

  useEffect(() => {
    if (!canHaveBoundary) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await territoriesApi.getBoundary(territory.id);
        if (!cancelled) {
          setBoundary(data);
          setDraft(data);
          setGeoJsonText(data ? JSON.stringify(data, null, 2) : "");
        }
      } catch {
        if (!cancelled) {
          toast({
            title: "Error",
            description: "Failed to load boundary",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [territory.id, canHaveBoundary]);

  if (!canHaveBoundary) {
    return (
      <p className="text-sm text-gray-500">
        This territory type cannot have a boundary.
      </p>
    );
  }

  const handleSave = async () => {
    const payload =
      mode === "json"
        ? parseGeoJsonPolygon(geoJsonText)
        : normalizeTerritoryBoundary(draft);
    if (!payload) {
      toast({
        title: "Validation",
        description: "Provide a valid GeoJSON polygon",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const result = await territoriesApi.saveBoundary(territory.id, payload);
      setBoundary(payload);
      setDraft(payload);

      if (result.mode === "operational") {
        toast({
          title: "Boundary saved",
          description: `Indexed across ${result.membershipCount} reference region(s).`,
          variant: "success",
        });
      } else if (result.parentAssignmentStatus === "ambiguous") {
        toast({
          title: "Boundary saved — review parent",
          description:
            "This territory overlaps multiple parents. Primary parent was not changed automatically.",
          variant: "destructive",
        });
      } else if (result.rollupAncestorIds.length > 0) {
        toast({
          title: "Boundary saved",
          description: `Linked to parent and ${result.rollupAncestorIds.length} secondary rollup region(s).`,
          variant: "success",
        });
      } else {
        toast({
          title: "Success",
          description: "Boundary saved",
          variant: "success",
        });
      }

      onUpdated();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to save boundary"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading boundary...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        A territory can include multiple polygons. Update them to adjust geo-linked parents and
        clinic assignment. Boundaries cannot be removed for this territory type.
        {boundary ? ` Currently ${polygonCount(boundary)} polygon(s).` : ""}
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "map" ? "default" : "outline"}
          onClick={() => setMode("map")}
        >
          Map
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "json" ? "default" : "outline"}
          onClick={() => setMode("json")}
        >
          GeoJSON
        </Button>
      </div>

      {mode === "map" ? (
        <TerritoryMapEditor
          value={draft}
          onChange={setDraft}
          readOnly={!canEdit}
        />
      ) : (
        <div>
          <Label htmlFor="boundary-json">GeoJSON</Label>
          <textarea
            id="boundary-json"
            className="mt-1 min-h-[200px] w-full rounded-md border p-2 font-mono text-xs"
            value={geoJsonText}
            onChange={(e) => setGeoJsonText(e.target.value)}
            disabled={!canEdit}
          />
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save boundary"}
          </Button>
        </div>
      )}
    </div>
  );
}
