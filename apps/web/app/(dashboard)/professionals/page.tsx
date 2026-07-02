"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { professionalsApi } from "@/lib/api/professionals";
import { facilitiesApi } from "@/lib/api/facilities";
import { getApiErrorMessage } from "@/lib/api/errors";
import { canManageProfessionals, canReadProfessionals } from "@/lib/permissions";
import type { Facility, Professional } from "@/types/facility";
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

export default function ProfessionalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formFacilityIds, setFormFacilityIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canRead = user ? canReadProfessionals(user.role.name) : false;
  const canManage = user ? canManageProfessionals(user.role.name) : false;

  useEffect(() => {
    if (user && !canRead) {
      router.replace("/unauthorized");
    }
  }, [user, canRead, router]);

  useEffect(() => {
    if (!canRead) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [professionalsResponse, facilitiesResponse] = await Promise.all([
          professionalsApi.getProfessionals({
            page,
            limit: 10,
            search: search || undefined,
          }),
          facilitiesApi.getFacilities({ limit: 100 }),
        ]);

        setProfessionals(professionalsResponse.data);
        setTotalPages(professionalsResponse.pagination.totalPages);
        setFacilities(facilitiesResponse.data);
      } catch (error) {
        toast({
          title: "Error",
          description: getApiErrorMessage(error, "Failed to load professionals"),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [page, search, refreshKey, canRead]);

  const facilityNameById = (facilityId: string) =>
    facilities.find((facility) => facility.id === facilityId)?.name ?? facilityId;

  const openCreateDialog = () => {
    setEditingProfessional(null);
    setFormFirstName("");
    setFormLastName("");
    setFormSpecialty("");
    setFormFacilityIds([]);
    setDialogOpen(true);
  };

  const openEditDialog = (professional: Professional) => {
    setEditingProfessional(professional);
    setFormFirstName(professional.firstName);
    setFormLastName(professional.lastName);
    setFormSpecialty(professional.specialty ?? professional.primarySpecialtyLabel ?? "");
    setFormFacilityIds(professional.facilityIds);
    setDialogOpen(true);
  };

  const toggleFacilitySelection = (facilityId: string) => {
    setFormFacilityIds((current) =>
      current.includes(facilityId)
        ? current.filter((id) => id !== facilityId)
        : [...current, facilityId]
    );
  };

  const handleSave = async () => {
    if (!formFirstName.trim() || !formLastName.trim()) {
      toast({
        title: "Validation",
        description: "First and last name are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingProfessional) {
        await professionalsApi.updateProfessional(editingProfessional.id, {
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          primarySpecialtyLabel: formSpecialty.trim() || null,
        });
        toast({ title: "Success", description: "Professional updated" });
        setDialogOpen(false);
        setRefreshKey((value) => value + 1);
      } else {
        const created = await professionalsApi.createProfessional({
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          primarySpecialtyLabel: formSpecialty.trim() || undefined,
          facilityIds: formFacilityIds,
        });
        toast({ title: "Success", description: "Professional created" });
        setDialogOpen(false);
        router.push(`/professionals/${created.id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to save professional"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (professional: Professional) => {
    if (!confirm(`Delete ${professional.firstName} ${professional.lastName}?`)) return;

    try {
      await professionalsApi.deleteProfessional(professional.id);
      toast({ title: "Success", description: "Professional deleted" });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to delete professional"),
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
          <h1 className="text-3xl font-bold text-gray-900">Professionals</h1>
          <p className="mt-1 text-sm text-gray-500">Manage professionals and facility assignments</p>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add professional
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search professionals..."
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
            <div className="py-8 text-center text-gray-500">Loading professionals...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Facilities</TableHead>
                    {canManage && <TableHead className="w-[120px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professionals.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canManage ? 4 : 3}
                        className="text-center text-gray-500"
                      >
                        No professionals found
                      </TableCell>
                    </TableRow>
                  ) : (
                    professionals.map((professional) => (
                      <TableRow key={professional.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/professionals/${professional.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {professional.firstName} {professional.lastName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {professional.specialty || professional.primarySpecialtyLabel || "—"}
                        </TableCell>
                        <TableCell>
                          {professional.facilityIds.map(facilityNameById).join(", ") || "—"}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(professional)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(professional)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProfessional ? "Edit professional" : "Create professional"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="professional-first-name">First name</Label>
              <Input
                id="professional-first-name"
                value={formFirstName}
                onChange={(event) => setFormFirstName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="professional-last-name">Last name</Label>
              <Input
                id="professional-last-name"
                value={formLastName}
                onChange={(event) => setFormLastName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="professional-specialty">Specialty</Label>
              <Input
                id="professional-specialty"
                value={formSpecialty}
                onChange={(event) => setFormSpecialty(event.target.value)}
              />
            </div>
            {!editingProfessional && (
              <div>
                <Label>Facilities (optional)</Label>
                <p className="mt-1 text-xs text-gray-500">
                  Leave unselected to create without facility links. Associate later from a facility
                  page.
                </p>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                  {facilities.length === 0 ? (
                    <p className="text-sm text-gray-500">No facilities available</p>
                  ) : (
                    facilities.map((facility) => (
                      <label key={facility.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formFacilityIds.includes(facility.id)}
                          onChange={() => toggleFacilitySelection(facility.id)}
                        />
                        {facility.name}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
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
