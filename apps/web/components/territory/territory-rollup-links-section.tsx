"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TerritoryPicker } from "@/components/territory/territory-picker";
import { territoriesApi } from "@/lib/api/territories";
import { getApiErrorMessage } from "@/lib/api/errors";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import type { TerritoryRollupLink } from "@/types/territory";

interface TerritoryRollupLinksSectionProps {
  territoryId: string;
  canManage: boolean;
}

export function TerritoryRollupLinksSection({
  territoryId,
  canManage,
}: TerritoryRollupLinksSectionProps) {
  const [links, setLinks] = useState<TerritoryRollupLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [ancestorId, setAncestorId] = useState("");
  const [saving, setSaving] = useState(false);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await territoriesApi.listRollupLinks(territoryId);
      setLinks(response.data);
    } catch {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [territoryId]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const handleAdd = async () => {
    if (!ancestorId) return;

    setSaving(true);
    try {
      await territoriesApi.addRollupLink(territoryId, { ancestorId });
      setAncestorId("");
      await loadLinks();
      toast({
        title: "Success",
        description: "Secondary rollup link added",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to add rollup link"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (linkId: string) => {
    try {
      await territoriesApi.removeRollupLink(territoryId, linkId);
      await loadLinks();
      toast({ title: "Success", description: "Rollup link removed", variant: "success" });
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to remove rollup link"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">Secondary rollup links</h4>
        <p className="text-xs text-gray-500">
          Secondary reporting links for cross-cutting geo overlaps. Does not change rep scope or
          clinic assignment.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rollup links...
        </div>
      ) : links.length === 0 ? (
        <p className="text-sm text-gray-500">No secondary rollup links.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>
                {link.ancestor
                  ? `${link.ancestor.code} — ${link.ancestor.name} (${link.ancestor.territoryType.name})`
                  : link.ancestorId}
                {link.source === "geo" ? " (geo)" : " (manual)"}
              </span>
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemove(link.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="space-y-2 border-t pt-3">
          <Label>Add reporting rollup</Label>
          <TerritoryPicker
            value={ancestorId}
            onChange={setAncestorId}
            excludeTerritoryIds={[territoryId]}
            placeholder="Select ancestor territory"
          />
          <Button type="button" size="sm" onClick={() => void handleAdd()} disabled={saving || !ancestorId}>
            {saving ? "Adding..." : "Add rollup link"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
