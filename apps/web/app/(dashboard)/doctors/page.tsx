"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { doctorsApi } from "@/lib/api/doctors";
import { clinicsApi } from "@/lib/api/clinics";
import { canManageDoctors, canReadDoctors } from "@/lib/permissions";
import type { Clinic, Doctor } from "@/types/clinic";
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

export default function DoctorsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formSpecialty, setFormSpecialty] = useState("");
  const [formClinicIds, setFormClinicIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canRead = user ? canReadDoctors(user.role.name) : false;
  const canManage = user ? canManageDoctors(user.role.name) : false;

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
        const [doctorsResponse, clinicsResponse] = await Promise.all([
          doctorsApi.getDoctors({
            page,
            limit: 10,
            search: search || undefined,
          }),
          clinicsApi.getClinics({ limit: 100 }),
        ]);

        setDoctors(doctorsResponse.data);
        setTotalPages(doctorsResponse.pagination.totalPages);
        setClinics(clinicsResponse.data);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load doctors",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [page, search, refreshKey, canRead]);

  const clinicNameById = (clinicId: string) =>
    clinics.find((clinic) => clinic.id === clinicId)?.name ?? clinicId;

  const openCreateDialog = () => {
    setEditingDoctor(null);
    setFormFirstName("");
    setFormLastName("");
    setFormSpecialty("");
    setFormClinicIds([]);
    setDialogOpen(true);
  };

  const openEditDialog = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setFormFirstName(doctor.firstName);
    setFormLastName(doctor.lastName);
    setFormSpecialty(doctor.specialty ?? "");
    setFormClinicIds(doctor.clinicIds);
    setDialogOpen(true);
  };

  const toggleClinicSelection = (clinicId: string) => {
    setFormClinicIds((current) =>
      current.includes(clinicId)
        ? current.filter((id) => id !== clinicId)
        : [...current, clinicId]
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

    if (formClinicIds.length === 0) {
      toast({
        title: "Validation",
        description: "Select at least one clinic",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingDoctor) {
        await doctorsApi.updateDoctor(editingDoctor.id, {
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          specialty: formSpecialty.trim() || null,
          clinicIds: formClinicIds,
        });
        toast({ title: "Success", description: "Doctor updated", variant: "success" });
      } else {
        await doctorsApi.createDoctor({
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          specialty: formSpecialty.trim() || undefined,
          clinicIds: formClinicIds,
        });
        toast({ title: "Success", description: "Doctor created", variant: "success" });
      }

      setDialogOpen(false);
      setRefreshKey((value) => value + 1);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save doctor",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doctor: Doctor) => {
    if (!confirm(`Delete Dr. ${doctor.lastName}?`)) return;

    try {
      await doctorsApi.deleteDoctor(doctor.id);
      toast({ title: "Success", description: "Doctor deleted", variant: "success" });
      setRefreshKey((value) => value + 1);
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete doctor",
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
          <h1 className="text-3xl font-bold text-gray-900">Doctors</h1>
          <p className="mt-1 text-sm text-gray-500">Manage doctors and clinic assignments</p>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Doctor
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search doctors..."
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
            <div className="py-8 text-center text-gray-500">Loading doctors...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Specialty</TableHead>
                    <TableHead>Clinics</TableHead>
                    {canManage && <TableHead className="w-[120px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 4 : 3} className="text-center text-gray-500">
                        No doctors found
                      </TableCell>
                    </TableRow>
                  ) : (
                    doctors.map((doctor) => (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">
                          {doctor.firstName} {doctor.lastName}
                        </TableCell>
                        <TableCell>{doctor.specialty || "—"}</TableCell>
                        <TableCell>
                          {doctor.clinicIds.map(clinicNameById).join(", ") || "—"}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(doctor)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(doctor)}
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
            <DialogTitle>{editingDoctor ? "Edit Doctor" : "Create Doctor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doctor-first-name">First Name</Label>
              <Input
                id="doctor-first-name"
                value={formFirstName}
                onChange={(event) => setFormFirstName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="doctor-last-name">Last Name</Label>
              <Input
                id="doctor-last-name"
                value={formLastName}
                onChange={(event) => setFormLastName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="doctor-specialty">Specialty</Label>
              <Input
                id="doctor-specialty"
                value={formSpecialty}
                onChange={(event) => setFormSpecialty(event.target.value)}
              />
            </div>
            <div>
              <Label>Clinics</Label>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {clinics.length === 0 ? (
                  <p className="text-sm text-gray-500">No clinics available</p>
                ) : (
                  clinics.map((clinic) => (
                    <label key={clinic.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formClinicIds.includes(clinic.id)}
                        onChange={() => toggleClinicSelection(clinic.id)}
                      />
                      {clinic.name}
                    </label>
                  ))
                )}
              </div>
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
