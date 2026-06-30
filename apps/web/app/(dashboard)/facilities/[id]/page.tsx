"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { clinicsApi } from "@/lib/api/facilities";
import { clinicDoctorsApi } from "@/lib/api/registry";
import { doctorsApi } from "@/lib/api/professionals";
import type {
  Facility,
  FacilityProfessionalListItem,
  Professional,
  FacilityProfessionalView,
} from "@/types/facility";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Link2, Unlink } from "lucide-react";

const VIEWS: { value: FacilityProfessionalView; label: string }[] = [
  { value: "all", label: "All active" },
  { value: "source", label: "Source" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending confirmation" },
];

export default function ClinicDetailPage() {
  const params = useParams<{ id: string }>();
  const facilityId = params.id;
  const { toast } = useToast();

  const [clinic, setClinic] = useState<Facility | null>(null);
  const [view, setView] = useState<FacilityProfessionalView>("all");
  const [doctors, setDoctors] = useState<FacilityProfessionalListItem[]>([]);
  const [allDoctors, setAllDoctors] = useState<Professional[]>([]);
  const [associateDoctorId, setAssociateDoctorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const loadFacility = useCallback(async () => {
    try {
      const data = await clinicsApi.getFacility(facilityId);
      setClinic(data);
    } catch {
      toast({ title: "Error", description: "Failed to load clinic", variant: "destructive" });
    }
  }, [facilityId, toast]);

  const loadDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const response = await clinicDoctorsApi.listProfessionals(facilityId, { view, limit: 100 });
      setDoctors(response.data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load clinic doctors",
        variant: "destructive",
      });
    } finally {
      setLoadingDoctors(false);
    }
  }, [facilityId, view, toast]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadClinic();
      setLoading(false);
    })();
  }, [loadClinic]);

  useEffect(() => {
    void loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    void doctorsApi.getProfessionals({ limit: 100 }).then((response) => {
      setAllDoctors(response.data);
    });
  }, []);

  const handleConfirm = async (professionalId: string) => {
    try {
      await clinicDoctorsApi.confirmDoctor(facilityId, professionalId);
      toast({ title: "Confirmed", description: "Professional confirmed at clinic" });
      await loadDoctors();
    } catch {
      toast({ title: "Error", description: "Failed to confirm doctor", variant: "destructive" });
    }
  };

  const handleAssociate = async () => {
    if (!associateDoctorId) return;
    try {
      await clinicDoctorsApi.associateDoctor(facilityId, associateDoctorId);
      toast({ title: "Associated", description: "Professional linked to clinic" });
      setAssociateDoctorId("");
      await loadDoctors();
    } catch {
      toast({
        title: "Error",
        description: "Failed to associate doctor",
        variant: "destructive",
      });
    }
  };

  const handleEndAssociation = async (professionalId: string) => {
    if (!confirm("Remove this doctor from the clinic roster?")) return;
    try {
      await clinicDoctorsApi.endAssociation(facilityId, professionalId);
      toast({ title: "Removed", description: "Association ended" });
      await loadDoctors();
    } catch {
      toast({
        title: "Error",
        description: "Failed to end association",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading clinic...</div>;
  }

  if (!clinic) {
    return <div className="py-8 text-center text-gray-500">Facility not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/facilities">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{clinic.name}</h1>
          <p className="text-sm text-gray-500">{clinic.address || "No address"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Professional list view</p>
          <Select value={view} onValueChange={(value) => setView(value as FacilityProfessionalView)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEWS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <p className="mb-1 text-xs font-medium text-gray-500">Associate existing doctor</p>
            <Select value={associateDoctorId} onValueChange={setAssociateDoctorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {allDoctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.lastName}, {doctor.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssociate} disabled={!associateDoctorId}>
            <Link2 className="mr-2 h-4 w-4" />
            Associate
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        {loadingDoctors ? (
          <div className="py-8 text-center text-gray-500">Loading doctors...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Confirmed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                    No doctors in this view
                  </TableCell>
                </TableRow>
              ) : (
                doctors.map((row) => (
                  <TableRow key={row.facilityProfessionalId}>
                    <TableCell className="font-medium">
                      {row.doctor.lastName}, {row.doctor.firstName}
                    </TableCell>
                    <TableCell>{row.doctor.specialty || "—"}</TableCell>
                    <TableCell>
                      {row.association.sourceActive ? (
                        <Badge variant="secondary">Source</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {row.association.confirmedAt ? (
                        <Badge>Confirmed</Badge>
                      ) : row.association.pendingConfirmation ? (
                        <Badge variant="outline">Pending</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {row.association.pendingConfirmation && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirm(row.doctor.id)}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Confirm
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEndAssociation(row.doctor.id)}
                      >
                        <Unlink className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
