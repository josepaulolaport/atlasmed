"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { facilitiesApi } from "@/lib/api/facilities";
import { mapsApi } from "@/lib/api/maps";
import { getApiErrorMessage } from "@/lib/api/errors";
import { canManageFacilities, canReadFacilities } from "@/lib/permissions";
import { useTerritoryLabels } from "@/components/territory/territory-picker";
import type { Facility } from "@/types/facility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

function territoryStatusBadge(status?: Facility["territoryAssignmentStatus"]) {
  if (!status || status === "assigned") return null;
  return (
    <Badge variant={status === "ambiguous" ? "secondary" : "outline"} className="ml-2 text-xs">
      {status}
    </Badge>
  );
}

export default function FacilitiesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canRead = user ? canReadFacilities(user.role.name) : false;
  const canManage = user ? canManageFacilities(user.role.name) : false;
  const { getLabel } = useTerritoryLabels();

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (!canRead) return;

    const loadFacilities = async () => {
      setLoading(true);
      try {
        const response = await facilitiesApi.getFacilities({
          page,
          limit: 10,
          search: search || undefined,
        });
        setFacilities(response.data);
        setTotalPages(response.pagination.totalPages);
      } catch (error) {
        toast({
          title: "Error",
          description: getApiErrorMessage(error, "Failed to load facilities"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadFacilities();
  }, [page, search, refreshKey, canRead]);

  const openCreateDialog = () => {
    setEditingFacility(null);
    setFormName("");
    setFormAddress("");
    setFormLat("");
    setFormLng("");
    setDialogOpen(true);
  };

  const openEditDialog = (facility: Facility) => {
    setEditingFacility(facility);
    setFormName(facility.name);
    setFormAddress(facility.address ?? "");
    setFormLat(facility.lat != null ? String(facility.lat) : "");
    setFormLng(facility.lng != null ? String(facility.lng) : "");
    setDialogOpen(true);
  };

  const parseCoordinate = (value: string): number | null | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleGeocodeAddress = async () => {
    if (!formAddress.trim()) {
      toast({
        title: "Validation",
        description: "Enter an address to geocode",
        variant: "destructive",
      });
      return;
    }

    setGeocoding(true);
    try {
      const result = await mapsApi.forwardGeocode(formAddress.trim());
      if (!result) {
        toast({
          title: "Not found",
          description: "Could not resolve coordinates for this address",
          variant: "destructive",
        });
        return;
      }

      setFormLat(String(result.latitude));
      setFormLng(String(result.longitude));
      toast({
        title: "Geocoded",
        description: result.fullAddress ?? "Coordinates updated from address",
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Geocoding failed. Check that Mapbox is configured on the API.",
        variant: "destructive",
      });
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({
        title: "Validation",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    const lat = parseCoordinate(formLat);
    const lng = parseCoordinate(formLng);
    if (lat === undefined || lng === undefined) {
      toast({
        title: "Validation",
        description: "Latitude and longitude must be valid numbers when provided",
        variant: "destructive",
      });
      return;
    }

    if (lat == null && lng == null && !formAddress.trim()) {
      toast({
        title: "Validation",
        description: "Provide an address or coordinates",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingFacility) {
        await facilitiesApi.updateFacility(editingFacility.id, {
          name: formName.trim(),
          address: formAddress.trim() || null,
          lat,
          lng,
        });
        toast({
          title: "Success",
          description: "Facility updated. Territory will be assigned automatically from coordinates.",
          variant: "success",
        });
      } else {
        await facilitiesApi.createFacility({
          name: formName.trim(),
          address: formAddress.trim() || undefined,
          lat: lat ?? undefined,
          lng: lng ?? undefined,
        });
        toast({
          title: "Success",
          description: "Facility created. Territory will be assigned automatically when coordinates match a boundary.",
          variant: "success",
        });
      }

      setDialogOpen(false);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to save facility"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (facility: Facility) => {
    if (!confirm(`Delete facility "${facility.name}"?`)) return;

    try {
      await facilitiesApi.deleteFacility(facility.id);
      toast({ title: "Success", description: "Facility deleted", variant: "success" });
      setRefreshKey((value) => value + 1);
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete clinic",
        variant: "destructive",
      });
    }
  };

  if (!canRead) {
    return null;
  }

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
              Facilities
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Facilities are assigned to territories automatically from coordinates.
            </p>
          </div>
          {canManage && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Add facility
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50/50">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search facilities..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
          </div>
          <div className="p-0">
          {loading ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              Loading facilities…
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Territory</TableHead>
                    {canManage && <TableHead className="w-[120px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilities.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 5 : 4}
                        className="text-center text-gray-500"
                      >
                        No facilities found
                      </TableCell>
                    </TableRow>
                  ) : (
                    facilities.map((facility) => (
                      <TableRow key={facility.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/facilities/${facility.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {facility.name}
                          </Link>
                        </TableCell>
                        <TableCell>{facility.address || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {facility.lat != null && facility.lng != null
                            ? `${facility.lat.toFixed(4)}, ${facility.lng.toFixed(4)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span>
                            {facility.territoryId ? getLabel(facility.territoryId) : "—"}
                          </span>
                          {territoryStatusBadge(facility.territoryAssignmentStatus)}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(facility)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(facility)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-zinc-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFacility ? "Edit facility" : "Create facility"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clinic-name">Name</Label>
              <Input
                id="clinic-name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clinic-address">Address</Label>
              <div className="flex gap-2">
                <Input
                  id="clinic-address"
                  value={formAddress}
                  onChange={(event) => setFormAddress(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding}
                >
                  {geocoding ? "Geocoding..." : "Geocode"}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="clinic-lat">Latitude</Label>
                <Input
                  id="clinic-lat"
                  type="number"
                  step="any"
                  placeholder="-23.5505"
                  value={formLat}
                  onChange={(event) => setFormLat(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="clinic-lng">Longitude</Label>
                <Input
                  id="clinic-lng"
                  type="number"
                  step="any"
                  placeholder="-46.6333"
                  value={formLng}
                  onChange={(event) => setFormLng(event.target.value)}
                />
              </div>
            </div>
            {editingFacility?.territoryId && (
              <p className="text-sm text-gray-600">
                Current territory: {getLabel(editingFacility.territoryId)} (assigned automatically)
              </p>
            )}
            <p className="text-xs text-gray-500">
              Coordinates are saved to the clinic record when geocoded (preview or on save).
              Territory assignment runs automatically from stored coordinates.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
