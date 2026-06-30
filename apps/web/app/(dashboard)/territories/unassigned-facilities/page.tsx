"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  canReadTerritories,
  isAdmin,
} from "@/lib/permissions";
import { territoriesApi } from "@/lib/api/territories";
import { getApiErrorMessage } from "@/lib/api/errors";
import { TerritorySubnav } from "@/components/territory/territory-subnav";
import { TerritoryPicker } from "@/components/territory/territory-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { UnassignedFacility } from "@/types/territory";

export default function UnassignedFacilitiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clinics, setClinics] = useState<UnassignedClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [overrideFacility, setOverrideClinic] = useState<UnassignedFacility | null>(null);
  const [overrideTerritoryId, setOverrideTerritoryId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const canRead = user ? canReadTerritories(user.role.name) : false;
  const userIsAdmin = user ? isAdmin(user.role.name) : false;

  const loadClinics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await territoriesApi.listUnassignedFacilities({ page, limit: 20 });
      setClinics(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load unassigned clinics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (canRead) {
      void loadClinics();
    }
  }, [canRead, loadClinics]);

  const handleOverride = async () => {
    if (!overrideFacility || !overrideTerritoryId) return;

    setSaving(true);
    try {
      await territoriesApi.overrideClinicTerritory(overrideClinic.id, {
        territoryId: overrideTerritoryId,
        reason: overrideReason.trim() || undefined,
      });
      toast({
        title: "Success",
        description: "Facility territory overridden",
        variant: "success",
      });
      setOverrideClinic(null);
      setOverrideTerritoryId("");
      setOverrideReason("");
      await loadClinics();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to override territory"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async (facilityId: string) => {
    setUnlockingId(facilityId);
    try {
      await territoriesApi.unlockClinicGeo(facilityId);
      toast({
        title: "Success",
        description: "Facility geo lock removed",
        variant: "success",
      });
      await loadClinics();
    } catch (err) {
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Failed to unlock clinic geo"),
        variant: "destructive",
      });
    } finally {
      setUnlockingId(null);
    }
  };

  if (!user || !canRead) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Unassigned clinics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Clinics without a resolved territory assignment
        </p>
      </div>

      <TerritorySubnav />

      <Card>
        <CardHeader>
          <CardTitle>Clinics needing territory</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Status</TableHead>
                    {userIsAdmin && <TableHead className="w-[200px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinics.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={userIsAdmin ? 4 : 3}
                        className="text-center text-gray-500"
                      >
                        No unassigned clinics found
                      </TableCell>
                    </TableRow>
                  ) : (
                    clinics.map((clinic) => (
                      <TableRow key={clinic.id}>
                        <TableCell>
                          <Link
                            href={`/facilities/${clinic.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {clinic.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {clinic.lat != null && clinic.lng != null
                            ? `${clinic.lat.toFixed(4)}, ${clinic.lng.toFixed(4)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              clinic.territoryAssignmentStatus === "ambiguous"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {clinic.territoryAssignmentStatus}
                          </Badge>
                        </TableCell>
                        {userIsAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setOverrideClinic(clinic);
                                  setOverrideTerritoryId("");
                                  setOverrideReason("");
                                }}
                              >
                                Override
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnlock(clinic.id)}
                                disabled={unlockingId === clinic.id}
                              >
                                {unlockingId === clinic.id ? "..." : "Unlock geo"}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={overrideFacility !== null}
        onOpenChange={(open) => !open && setOverrideClinic(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override clinic territory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Clinic: {overrideClinic?.id}</p>
            <div>
              <Label>Territory</Label>
              <TerritoryPicker
                value={overrideTerritoryId}
                onChange={setOverrideTerritoryId}
                filterAssignableToUsers
              />
            </div>
            <div>
              <Label htmlFor="override-reason">Reason (optional)</Label>
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideClinic(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleOverride}
              disabled={saving || !overrideTerritoryId}
            >
              {saving ? "Saving..." : "Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
