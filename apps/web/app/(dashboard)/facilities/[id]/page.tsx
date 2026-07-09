"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { facilitiesApi } from "@/lib/api/facilities";
import { facilityProfessionalsApi } from "@/lib/api/facility-professionals";
import { professionalsApi } from "@/lib/api/professionals";
import { registryApi } from "@/lib/api/registry";
import { getApiErrorMessage } from "@/lib/api/errors";
import type {
  Facility,
  FacilityProfessionalListItem,
  Professional,
  FacilityProfessionalView,
  RegistrySuggestion,
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
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TabKey =
  | "overview"
  | "professionals"
  | "registry"
  | "commercial"
  | "conformity"
  | "territory";

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

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<FacilityProfessionalView>("all");
  const [professionals, setProfessionals] = useState<FacilityProfessionalListItem[]>([]);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [associateProfessionalId, setAssociateProfessionalId] = useState("");
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);

  const [suggestions, setSuggestions] = useState<RegistrySuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const response = await registryApi.getSuggestions({
        status: "PENDING",
        limit: 100,
      });
      setSuggestions(
        response.data.filter((s) => s.facilityId === facilityId)
      );
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to load suggestions"),
        variant: "destructive",
      });
    } finally {
      setLoadingSuggestions(false);
    }
  }, [facilityId, toast]);

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
    void loadSuggestions();
  }, [loadSuggestions]);

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

  const handleApproveSuggestion = async (id: string) => {
    try {
      await registryApi.approveSuggestion(id);
      toast({ title: "Approved", description: "Registry suggestion applied" });
      await Promise.all([loadSuggestions(), loadProfessionals(), loadFacility()]);
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to approve"),
        variant: "destructive",
      });
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      await registryApi.rejectSuggestion(id);
      toast({ title: "Rejected", description: "Suggestion dismissed" });
      await loadSuggestions();
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to reject"),
        variant: "destructive",
      });
    }
  };

  const tabs = useMemo<TabItem[]>(
    () => [
      { value: "overview", label: "Overview" },
      {
        value: "professionals",
        label: "Professionals",
        badge: professionals.length ? String(professionals.length) : undefined,
        badgeVariant: "muted",
      },
      {
        value: "registry",
        label: "Registry",
        badge: suggestions.length ? `${suggestions.length} updates` : undefined,
        badgeVariant: "info",
      },
      { value: "commercial", label: "Commercial" },
      { value: "conformity", label: "Conformity" },
      { value: "territory", label: "Territory" },
    ],
    [professionals.length, suggestions.length]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="p-6 text-sm text-zinc-500">Facility not found.</div>
    );
  }

  const territoryStatus = facility.territoryAssignmentStatus;
  const pendingSuggestionCount = suggestions.length;

  return (
    <>
      <div className="px-6 py-8 border-b border-zinc-100">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-medium tracking-tight text-zinc-900">
                {facility.name}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-xs font-medium border border-zinc-200">
                ID: {facility.id.slice(0, 8)}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              {facility.address || "No address on file"}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <iconify-icon
                  icon="solar:map-point-linear"
                  stroke-width="1.5"
                  className="mr-1.5"
                />
                Territory:{" "}
                {facility.territoryId
                  ? `${facility.territoryId.slice(0, 8)} (${
                      territoryStatus ?? "assigned"
                    })`
                  : "Unassigned"}
              </Badge>
              <Badge
                variant={
                  territoryStatus === "assigned" ? "success" : "warning"
                }
              >
                <iconify-icon
                  icon="solar:shield-check-linear"
                  stroke-width="1.5"
                  className="mr-1.5"
                />
                Conformity:{" "}
                {territoryStatus === "assigned" ? "Validated" : "Review"}
              </Badge>
              {pendingSuggestionCount > 0 && (
                <Badge variant="warning">
                  <iconify-icon
                    icon="solar:inbox-in-linear"
                    stroke-width="1.5"
                    className="mr-1.5"
                  />
                  {pendingSuggestionCount} Pending Suggestion
                  {pendingSuggestionCount === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="default" asChild>
              <Link href={`/facilities`}>
                <iconify-icon icon="solar:arrow-left-linear" stroke-width="1.5" />
                Back
              </Link>
            </Button>
            <Button variant="outline" size="default">
              <iconify-icon icon="solar:pen-linear" stroke-width="1.5" />
              Edit
            </Button>
            <Button variant="outline" size="default">
              <iconify-icon icon="solar:map-linear" stroke-width="1.5" />
              Map View
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        items={tabs}
        value={activeTab}
        onChange={(v) => setActiveTab(v as TabKey)}
      />

      {activeTab === "overview" && (
        <OverviewTab facility={facility} />
      )}

      {activeTab === "professionals" && (
        <ProfessionalsTab
          facilityId={facilityId}
          view={view}
          setView={setView}
          professionals={professionals}
          allProfessionals={allProfessionals}
          associateProfessionalId={associateProfessionalId}
          setAssociateProfessionalId={setAssociateProfessionalId}
          onAssociate={handleAssociate}
          onConfirm={handleConfirm}
          onEnd={handleEndAssociation}
          loading={loadingProfessionals}
        />
      )}

      {activeTab === "registry" && (
        <RegistryTab
          suggestions={suggestions}
          loading={loadingSuggestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
        />
      )}

      {activeTab === "commercial" && <CommercialTab />}
      {activeTab === "conformity" && <ConformityTab />}
      {activeTab === "territory" && <TerritoryTab facility={facility} />}
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1">
        {label}
      </label>
      <div className="text-sm text-zinc-900">{value || "—"}</div>
    </div>
  );
}

function OverviewTab({ facility }: { facility: Facility }) {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                Facility Details
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 gap-6">
              <Field label="Name" value={facility.name} />
              <Field label="ID" value={facility.id} />
              <Field label="Address" value={facility.address} />
              <Field
                label="Coordinates"
                value={
                  facility.lat && facility.lng
                    ? `${facility.lat.toFixed(5)}, ${facility.lng.toFixed(5)}`
                    : undefined
                }
              />
              <Field
                label="Created"
                value={new Date(facility.createdAt).toLocaleDateString()}
              />
              <Field
                label="Updated"
                value={new Date(facility.updatedAt).toLocaleDateString()}
              />
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                Territory
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Territory ID" value={facility.territoryId} />
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Assignment Status
                </label>
                {facility.territoryAssignmentStatus ? (
                  <Badge
                    variant={
                      facility.territoryAssignmentStatus === "assigned"
                        ? "success"
                        : facility.territoryAssignmentStatus === "ambiguous"
                        ? "warning"
                        : "secondary"
                    }
                  >
                    {facility.territoryAssignmentStatus}
                  </Badge>
                ) : (
                  <div className="text-sm text-zinc-500">—</div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface ProfessionalsTabProps {
  facilityId: string;
  view: FacilityProfessionalView;
  setView: (v: FacilityProfessionalView) => void;
  professionals: FacilityProfessionalListItem[];
  allProfessionals: Professional[];
  associateProfessionalId: string;
  setAssociateProfessionalId: (id: string) => void;
  onAssociate: () => void;
  onConfirm: (id: string) => void;
  onEnd: (id: string) => void;
  loading: boolean;
}

function ProfessionalsTab({
  facilityId,
  view,
  setView,
  professionals,
  allProfessionals,
  associateProfessionalId,
  setAssociateProfessionalId,
  onAssociate,
  onConfirm,
  onEnd,
  loading,
}: ProfessionalsTabProps) {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500">View</p>
          <Select
            value={view}
            onValueChange={(value) => setView(value as FacilityProfessionalView)}
          >
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
            <p className="mb-1 text-xs font-medium text-zinc-500">
              Associate professional
            </p>
            <Select
              value={associateProfessionalId}
              onValueChange={setAssociateProfessionalId}
            >
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
          <Button onClick={onAssociate} disabled={!associateProfessionalId}>
            <iconify-icon icon="solar:link-linear" stroke-width="1.5" />
            Associate
          </Button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
          <h4 className="text-sm font-medium text-zinc-900 flex items-center gap-2">
            <iconify-icon
              icon="solar:stethoscope-linear"
              stroke-width="1.5"
              className="text-zinc-400"
            />
            Associated Professionals
            <span className="bg-zinc-100 text-zinc-600 py-0.5 px-2 rounded-full text-xs font-medium">
              {professionals.length}
            </span>
          </h4>
        </div>
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Loading professionals…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professionals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-zinc-500"
                  >
                    No professionals in this view
                  </TableCell>
                </TableRow>
              ) : (
                professionals.map((row) => (
                  <TableRow key={row.facilityProfessionalId}>
                    <TableCell className="font-medium text-zinc-900">
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
                        <Badge variant="success">Confirmed</Badge>
                      ) : row.association.pendingConfirmation ? (
                        <Badge variant="warning">Pending</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {row.association.pendingConfirmation && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onConfirm(row.professional.id)}
                        >
                          Confirm
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEnd(row.professional.id)}
                      >
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

interface RegistryTabProps {
  suggestions: RegistrySuggestion[];
  loading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function RegistryTab({
  suggestions,
  loading,
  onApprove,
  onReject,
}: RegistryTabProps) {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6 p-4 rounded-lg bg-zinc-50 border border-zinc-200 flex items-start gap-3">
        <iconify-icon
          icon="solar:info-circle-linear"
          stroke-width="1.5"
          className="text-zinc-400 text-lg mt-0.5"
        />
        <div>
          <h4 className="text-sm font-medium text-zinc-900">Registry Review</h4>
          <p className="text-sm text-zinc-500 mt-1">
            CNES data is imported and compared against your CRM truth. Approve
            or reject suggested changes below. Your manual edits are always
            protected and never silently overwritten.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          Loading suggestions…
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <iconify-icon
            icon="solar:check-circle-linear"
            stroke-width="1.5"
            className="text-emerald-500 text-3xl"
          />
          <h4 className="mt-3 text-sm font-medium text-zinc-900">
            No pending suggestions
          </h4>
          <p className="mt-1 text-sm text-zinc-500">
            This facility is in sync with the registry.
          </p>
        </div>
      ) : (
        suggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onApprove={() => onApprove(s.id)}
            onReject={() => onReject(s.id)}
          />
        ))
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
}: {
  suggestion: RegistrySuggestion;
  onApprove: () => void;
  onReject: () => void;
}) {
  const typeLabels: Record<RegistrySuggestion["type"], string> = {
    FACILITY_REGISTRY_DEACTIVATED: "Facility Deactivation",
    FACILITY_REGISTRY_REACTIVATED: "Facility Reactivation",
    DOCTOR_FACILITY_REGISTRY_DEACTIVATED: "Professional Removal",
  };
  const dotColor: Record<RegistrySuggestion["type"], string> = {
    FACILITY_REGISTRY_DEACTIVATED: "bg-amber-500",
    FACILITY_REGISTRY_REACTIVATED: "bg-emerald-500",
    DOCTOR_FACILITY_REGISTRY_DEACTIVATED: "bg-blue-500",
  };

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden mb-6 bg-white shadow-sm">
      <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full", dotColor[suggestion.type])} />
          <h3 className="text-sm font-medium text-zinc-900">
            {typeLabels[suggestion.type]}
          </h3>
          <span className="text-xs text-zinc-400 ml-2">
            Run #{suggestion.ingestionRunId.slice(0, 8)} •{" "}
            {new Date(suggestion.suggestedAt).toLocaleString()}
          </span>
        </div>
        <Badge variant="secondary">Pending</Badge>
      </div>

      <div className="p-5">
        <p className="text-sm text-zinc-700">
          {suggestion.reason || "Registry mismatch detected."}
        </p>
        {suggestion.payload && Object.keys(suggestion.payload).length > 0 && (
          <pre className="mt-3 rounded-md bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600 overflow-auto">
            {JSON.stringify(suggestion.payload, null, 2)}
          </pre>
        )}
      </div>

      <div className="px-5 py-4 border-t border-zinc-200 bg-white flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onReject}>
          Dismiss
        </Button>
        <Button onClick={onApprove}>Apply Suggestion</Button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: { direction: "up" | "down"; text: string };
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex flex-col justify-center">
      <span className="text-xs font-medium text-zinc-500 mb-1">{label}</span>
      <span className="text-2xl font-semibold tracking-tight text-zinc-900">
        {value}
      </span>
      {trend && (
        <span
          className={cn(
            "text-xs mt-2 flex items-center gap-1",
            trend.direction === "up" ? "text-emerald-600" : "text-red-600"
          )}
        >
          <iconify-icon
            icon={
              trend.direction === "up"
                ? "solar:trend-up-linear"
                : "solar:trend-down-linear"
            }
          />
          {trend.text}
        </span>
      )}
      {hint && !trend && (
        <span className="text-xs text-zinc-500 mt-2">{hint}</span>
      )}
    </div>
  );
}

function CommercialTab() {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard label="YTD Revenue" value="—" hint="Data not connected" />
        <StatCard label="Active Contracts" value="—" hint="Data not connected" />
        <StatCard label="Potential Score" value="—" hint="Data not connected" />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-zinc-500">
          Commercial pipeline integration coming soon.
        </p>
      </div>
    </div>
  );
}

function ConformityTab() {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3">
        <iconify-icon
          icon="solar:shield-check-linear"
          stroke-width="1.5"
          className="text-emerald-500 text-lg mt-0.5"
        />
        <div>
          <h4 className="text-sm font-medium text-emerald-900">
            Compliance status unknown
          </h4>
          <p className="text-sm text-emerald-700 mt-1">
            Licenses &amp; certifications tracking will surface here once the
            registry integration ships.
          </p>
        </div>
      </div>
    </div>
  );
}

function TerritoryTab({ facility }: { facility: Facility }) {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
          <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
            Geographic Assignment
          </h3>
        </div>
        <div className="p-5 grid grid-cols-2 gap-6">
          <Field label="Territory ID" value={facility.territoryId} />
          <Field
            label="Assignment Status"
            value={facility.territoryAssignmentStatus}
          />
          <Field
            label="Coordinates"
            value={
              facility.lat && facility.lng
                ? `${facility.lat.toFixed(5)}, ${facility.lng.toFixed(5)}`
                : undefined
            }
          />
          <Field label="Address" value={facility.address} />
        </div>
      </div>
    </div>
  );
}
