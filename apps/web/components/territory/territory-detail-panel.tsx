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
import { TerritoryRollupLinksSection } from "@/components/territory/territory-rollup-links-section";
import { AssignUserToTerritoryDialog } from "@/components/territory/assign-user-to-territory-dialog";
import { isApprovalRequest } from "@/components/territory/territory-utils";
import { Loader2 } from "lucide-react";
import type { Territory } from "@/types/territory";
import { formatDateTime } from "@/lib/utils";

interface TerritoryDetailPanelProps {
  territory: Territory | null;
  canManage: boolean;
  canUpdate: boolean;
  isAdmin: boolean;
  onRefresh: () => void;
  onReparent: () => void;
}

export function TerritoryDetailPanel({
  territory,
  canManage,
  canUpdate,
  isAdmin,
  onRefresh,
  onReparent,
}: TerritoryDetailPanelProps) {
  const [descendantIds, setDescendantIds] = useState<string[]>([]);
  const [loadingDescendants, setLoadingDescendants] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!territory) {
      setDescendantIds([]);
      return;
    }

    setEditName(territory.name);
    let cancelled = false;
    (async () => {
      setLoadingDescendants(true);
      try {
        const data = await territoriesApi.getDescendants(territory.id);
        if (!cancelled) setDescendantIds(data.descendantIds);
      } catch {
        if (!cancelled) setDescendantIds([]);
      } finally {
        if (!cancelled) setLoadingDescendants(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [territory]);

  if (!territory) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-64 items-center justify-center text-sm text-gray-500">
          Select a territory from the tree to view details.
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
    if (!confirm(`Deactivate territory ${territory.code}?`)) return;

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
                {territory.isCountryLevel ? (
                  <>
                    Market: <span className="font-medium">{territory.countryCode}</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">{territory.slug}</span>
                    {territory.countryCode ? (
                      <>
                        {" "}
                        · market {territory.countryCode}
                      </>
                    ) : null}
                  </>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="secondary">
                  {territory.territoryType.name}
                </Badge>
                {territory.isCountryLevel && <Badge variant="outline">country</Badge>}
                {territory.isLeaf && <Badge variant="outline">leaf</Badge>}
                {territory.hasBoundary && <Badge variant="outline">has boundary</Badge>}
                {territory.parentAssignmentStatus === "ambiguous" && (
                  <Badge variant="destructive">ambiguous parent</Badge>
                )}
                {territory.parentAssignmentSource && (
                  <Badge variant="outline">parent: {territory.parentAssignmentSource}</Badge>
                )}
                {!territory.isActive && <Badge variant="destructive">inactive</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  Assign user
                </Button>
              )}
              {canUpdate && (
                <Button size="sm" variant="outline" onClick={onReparent}>
                  Reparent
                </Button>
              )}
              {canUpdate && territory.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                >
                  {deactivating ? "Deactivating..." : "Deactivate"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            {!territory.isCountryLevel && (
              <div>
                <span className="text-gray-500">Identifier:</span> {territory.slug}
              </div>
            )}
            <div>
              <span className="text-gray-500">Market:</span>{" "}
              {territory.countryCode ?? "—"}
            </div>
            <div>
              <span className="text-gray-500">Clinics:</span> {territory.clinicCount}
            </div>
            <div>
              <span className="text-gray-500">Assigned users:</span>{" "}
              {territory.assignedUserCount}
            </div>
            <div>
              <span className="text-gray-500">Created:</span>{" "}
              {formatDateTime(territory.createdAt)}
            </div>
            <div>
              <span className="text-gray-500">Updated:</span>{" "}
              {formatDateTime(territory.updatedAt)}
            </div>
          </div>

          {canUpdate && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="territory-edit-name">Name</Label>
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
                {savingName ? "Saving..." : "Save name"}
              </Button>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Boundary</h3>
            <TerritoryBoundarySection
              territory={territory}
              canEdit={canUpdate}
              onUpdated={onRefresh}
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Descendants</h3>
            {loadingDescendants ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : descendantIds.length === 0 ? (
              <p className="text-sm text-gray-500">No descendants.</p>
            ) : (
              <p className="text-sm text-gray-700">{descendantIds.length} descendant(s)</p>
            )}
          </div>

          {territory.territoryType && !territory.territoryType.isCountryLevel && (
            <TerritoryRollupLinksSection
              territoryId={territory.id}
              canManage={canManage}
            />
          )}
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
