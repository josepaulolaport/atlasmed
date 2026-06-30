"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { clinicsApi } from "@/lib/api/facilities";
import { mapsApi } from "@/lib/api/maps";
import { canManageFacilities, canReadFacilities } from "@/lib/permissions";
import { useTerritoryLabels } from "@/components/territory/territory-picker";
import type { Facility } from "@/types/facility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function territoryStatusBadge(status?: Clinic["territoryAssignmentStatus"]) {
  if (!status || status === "assigned") return null;
  return (
    <Badge variant={status === "ambiguous" ? "secondary" : "outline"} className="ml-2 text-xs">
      {status}
    </Badge>
  );
}

export default function ClinicsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clinics, setClinics] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacility, setEditingClinic] = useState<Facility | null>(null);
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

    const loadClinics = async () => {
      setLoading(true);
      try {
        const response = await clinicsApi.getFacilitys({
          page,
          limit: 10,
          search: search || undefined,
        });
        setClinics(response.data);
        setTotalPages(response.pagination.totalPages);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load clinics",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadClinics();
  }, [page, search, refreshKey, canRead]);

  const openCreateDialog = () => {
    setEditingClinic(null);
    setFormName("");
    setFormAddress("");
    setFormLat("");
    setFormLng("");
    setDialogOpen(true);
  };

  const openEditDialog = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setFormName(clinic.name);
    setFormAddress(clinic.address ?? "");
    setFormLat(clinic.lat != null ? String(clinic.lat) : "");
    setFormLng(clinic.lng != null ? String(clinic.lng) : "");
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
      if (editingClinic) {
        await clinicsApi.updateFacility(editingClinic.id, {
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
        await clinicsApi.createFacility({
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
    } catch {
      toast({
        title: "Error",
        description: "Failed to save clinic",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (clinic: Clinic) => {
    if (!confirm(`Delete clinic "${clinic.name}"?`)) return;

    try {
      await clinicsApi.deleteFacility(clinic.id);
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clinics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Clinics are assigned to territories automatically from coordinates
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Clinic
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search clinics..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">Loading clinics...</div>
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
                  {clinics.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 5 : 4}
                        className="text-center text-gray-500"
                      >
                        No clinics found
                      </TableCell>
                    </TableRow>
                  ) : (
                    clinics.map((clinic) => (
                      <TableRow key={clinic.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/facilities/${clinic.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {clinic.name}
                          </Link>
                        </TableCell>
                        <TableCell>{clinic.address || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {clinic.lat != null && clinic.lng != null
                            ? `${clinic.lat.toFixed(4)}, ${clinic.lng.toFixed(4)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span>
                            {clinic.territoryId ? getLabel(clinic.territoryId) : "—"}
                          </span>
                          {territoryStatusBadge(clinic.territoryAssignmentStatus)}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(clinic)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(clinic)}
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

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFacility ? "Edit Clinic" : "Create Clinic"}</DialogTitle>
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
            {editingClinic?.territoryId && (
              <p className="text-sm text-gray-600">
                Current territory: {getLabel(editingClinic.territoryId)} (assigned automatically)
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
    </div>
  );
}
