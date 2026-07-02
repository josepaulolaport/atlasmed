"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { facilitiesApi } from "@/lib/api/facilities";
import { facilityProfessionalsApi } from "@/lib/api/facility-professionals";
import { professionalsApi } from "@/lib/api/professionals";
import { getApiErrorMessage } from "@/lib/api/errors";
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
import { ArrowLeft, Check, Link2, Pencil, Unlink } from "lucide-react";

const VIEWS: { value: FacilityProfessionalView; label: string }[] = [
  { value: "all", label: "All active" },
  { value: "source", label: "Source" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending confirmation" },
];

export default function FacilityDetailPage() {
  const params = useParams<{ id: string }>();
  const facilityId = params.id;
  const { toast } = useToast();

  const [facility, setFacility] = useState<Facility | null>(null);
  const [view, setView] = useState<FacilityProfessionalView>("all");
  const [professionals, setProfessionals] = useState<FacilityProfessionalListItem[]>([]);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [associateProfessionalId, setAssociateProfessionalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);

  const loadFacility = useCallback(async () => {
    try {
      const data = await facilitiesApi.getFacility(facilityId);
      setFacility(data);
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to load facility"),
        variant: "destructive",
      });
    }
  }, [facilityId, toast]);

  const loadProfessionals = useCallback(async () => {
    setLoadingProfessionals(true);
    try {
      const response = await facilityProfessionalsApi.listProfessionals(facilityId, {
        view,
        limit: 100,
      });
      setProfessionals(response.data);
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to load facility professionals"),
        variant: "destructive",
      });
    } finally {
      setLoadingProfessionals(false);
    }
  }, [facilityId, view, toast]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadFacility();
      setLoading(false);
    })();
  }, [loadFacility]);

  useEffect(() => {
    void loadProfessionals();
  }, [loadProfessionals]);

  useEffect(() => {
    void professionalsApi.getProfessionals({ limit: 100 }).then((response) => {
      setAllProfessionals(response.data);
    });
  }, []);

  const handleConfirm = async (professionalId: string) => {
    try {
      await facilityProfessionalsApi.confirmProfessional(facilityId, professionalId);
      toast({ title: "Confirmed", description: "Professional confirmed at facility" });
      await loadProfessionals();
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to confirm professional"),
        variant: "destructive",
      });
    }
  };

  const handleAssociate = async () => {
    if (!associateProfessionalId) return;
    try {
      await facilityProfessionalsApi.associateProfessional(facilityId, associateProfessionalId);
      toast({ title: "Associated", description: "Professional linked to facility" });
      setAssociateProfessionalId("");
      await loadProfessionals();
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to associate professional"),
        variant: "destructive",
      });
    }
  };

  const handleEndAssociation = async (professionalId: string) => {
    if (!confirm("Remove this professional from the facility roster?")) return;
    try {
      await facilityProfessionalsApi.endAssociation(facilityId, professionalId);
      toast({ title: "Removed", description: "Association ended" });
      await loadProfessionals();
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to end association"),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading facility...</div>;
  }

  if (!facility) {
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
          <h1 className="text-2xl font-bold text-gray-900">{facility.name}</h1>
          <p className="text-sm text-gray-500">{facility.address || "No address"}</p>
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
            <p className="mb-1 text-xs font-medium text-gray-500">Associate existing professional</p>
            <Select value={associateProfessionalId} onValueChange={setAssociateProfessionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Select professional" />
              </SelectTrigger>
              <SelectContent>
                {allProfessionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.lastName}, {professional.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssociate} disabled={!associateProfessionalId}>
            <Link2 className="mr-2 h-4 w-4" />
            Associate
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        {loadingProfessionals ? (
          <div className="py-8 text-center text-gray-500">Loading professionals...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Professional</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Confirmed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professionals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                    No professionals in this view
                  </TableCell>
                </TableRow>
              ) : (
                professionals.map((row) => (
                  <TableRow key={row.facilityProfessionalId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/facilities/${facilityId}/professionals/${row.professional.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {row.professional.lastName}, {row.professional.firstName}
                      </Link>
                    </TableCell>
                    <TableCell>{row.professional.specialty || "—"}</TableCell>
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
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/facilities/${facilityId}/professionals/${row.professional.id}`}
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          Edit registration
                        </Link>
                      </Button>
                      {row.association.pendingConfirmation && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfirm(row.professional.id)}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Confirm
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEndAssociation(row.professional.id)}
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
