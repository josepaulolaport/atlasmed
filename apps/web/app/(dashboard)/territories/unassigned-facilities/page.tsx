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
  const [facilities, setFacilities] = useState<UnassignedFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [overrideFacility, setOverrideFacility] = useState<UnassignedFacility | null>(null);
  const [overrideTerritoryId, setOverrideTerritoryId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  const canRead = user ? canReadTerritories(user.role.name) : false;
  const userIsAdmin = user ? isAdmin(user.role.name) : false;

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    try {
      const response = await territoriesApi.listUnassignedFacilities({ page, limit: 20 });
      setFacilities(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load unassigned facilities",
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
      void loadFacilities();
    }
  }, [canRead, loadFacilities]);

  const handleOverride = async () => {
    if (!overrideFacility || !overrideTerritoryId) return;

    setSaving(true);
    try {
      await territoriesApi.overrideClinicTerritory(overrideFacility.id, {
        territoryId: overrideTerritoryId,
        reason: overrideReason.trim() || undefined,
      });
      toast({
        title: "Success",
        description: "Facility territory overridden",
        variant: "success",
      });
      setOverrideFacility(null);
      setOverrideTerritoryId("");
      setOverrideReason("");
      await loadFacilities();
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
      await loadFacilities();
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
        <h1 className="text-3xl font-bold text-gray-900">Clínicas não atribuídas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Clínicas sem atribuição de território resolvida
        </p>
      </div>

      <TerritorySubnav />

      <Card>
        <CardHeader>
          <CardTitle>Clínicas que precisam de território</CardTitle>
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
                    <TableHead>Clínica</TableHead>
                    <TableHead>Coordenadas</TableHead>
                    <TableHead>Status</TableHead>
                    {userIsAdmin && <TableHead className="w-[200px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilities.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={userIsAdmin ? 4 : 3}
                        className="text-center text-gray-500"
                      >
                        Nenhuma clínica não atribuída encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    facilities.map((facility) => (
                      <TableRow key={facility.id}>
                        <TableCell>
                          <Link
                            href={`/facilities/${facility.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {facility.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {facility.lat != null && facility.lng != null
                            ? `${facility.lat.toFixed(4)}, ${facility.lng.toFixed(4)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              facility.territoryAssignmentStatus === "ambiguous"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {facility.territoryAssignmentStatus}
                          </Badge>
                        </TableCell>
                        {userIsAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setOverrideFacility(facility);
                                  setOverrideTerritoryId("");
                                  setOverrideReason("");
                                }}
                              >
                                Substituir
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnlock(facility.id)}
                                disabled={unlockingId === facility.id}
                              >
                                {unlockingId === facility.id ? "..." : "Desbloquear geo"}
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
                  Anterior
                </Button>
                <span className="text-sm text-gray-500">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={overrideFacility !== null}
        onOpenChange={(open) => !open && setOverrideFacility(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substituir território da clínica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Unidade: {overrideFacility?.id}</p>
            <div>
              <Label>Território</Label>
              <TerritoryPicker
                value={overrideTerritoryId}
                onChange={setOverrideTerritoryId}
                filterAssignableToUsers
              />
            </div>
            <div>
              <Label htmlFor="override-reason">Motivo (opcional)</Label>
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideFacility(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleOverride}
              disabled={saving || !overrideTerritoryId}
            >
              {saving ? "Salvando..." : "Substituir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
