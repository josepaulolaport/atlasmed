"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { clinicsApi } from "@/lib/api/clinics";
import { canManageClinics, canReadClinics } from "@/lib/permissions";
import type { Clinic } from "@/types/clinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function ClinicsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formTerritoryId, setFormTerritoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canRead = user ? canReadClinics(user.role.name) : false;
  const canManage = user ? canManageClinics(user.role.name) : false;

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
        const response = await clinicsApi.getClinics({
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
    setFormTerritoryId("");
    setDialogOpen(true);
  };

  const openEditDialog = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setFormName(clinic.name);
    setFormAddress(clinic.address ?? "");
    setFormTerritoryId(clinic.territoryId ?? "");
    setDialogOpen(true);
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

    setSaving(true);
    try {
      if (editingClinic) {
        await clinicsApi.updateClinic(editingClinic.id, {
          name: formName.trim(),
          address: formAddress.trim() || null,
          territoryId: formTerritoryId.trim() || null,
        });
        toast({ title: "Success", description: "Clinic updated", variant: "success" });
      } else {
        await clinicsApi.createClinic({
          name: formName.trim(),
          address: formAddress.trim() || undefined,
          territoryId: formTerritoryId.trim() || undefined,
        });
        toast({ title: "Success", description: "Clinic created", variant: "success" });
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
      await clinicsApi.deleteClinic(clinic.id);
      toast({ title: "Success", description: "Clinic deleted", variant: "success" });
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
          <p className="mt-1 text-sm text-gray-500">Manage clinic locations</p>
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
                    <TableHead>Territory</TableHead>
                    {canManage && <TableHead className="w-[120px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clinics.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 4 : 3} className="text-center text-gray-500">
                        No clinics found
                      </TableCell>
                    </TableRow>
                  ) : (
                    clinics.map((clinic) => (
                      <TableRow key={clinic.id}>
                        <TableCell className="font-medium">{clinic.name}</TableCell>
                        <TableCell>{clinic.address || "—"}</TableCell>
                        <TableCell>{clinic.territoryId || "—"}</TableCell>
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
            <DialogTitle>{editingClinic ? "Edit Clinic" : "Create Clinic"}</DialogTitle>
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
              <Input
                id="clinic-address"
                value={formAddress}
                onChange={(event) => setFormAddress(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="clinic-territory">Territory ID</Label>
              <Input
                id="clinic-territory"
                value={formTerritoryId}
                onChange={(event) => setFormTerritoryId(event.target.value)}
              />
            </div>
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
