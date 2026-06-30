"use client";

import { useCallback, useEffect, useState } from "react";
import { registryApi } from "@/lib/api/registry";
import type { RegistryDemoResult, RegistrySuggestion } from "@/types/facility";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { hasMinimumRole } from "@/lib/permissions";

const TYPE_LABELS: Record<RegistrySuggestion["type"], string> = {
  FACILITY_REGISTRY_DEACTIVATED: "Remove clinic",
  FACILITY_REGISTRY_REACTIVATED: "Reactivate clinic",
  DOCTOR_FACILITY_REGISTRY_DEACTIVATED: "Remove doctor from clinic",
};

function getPayloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getFacilityLabel(suggestion: RegistrySuggestion): string {
  return (
    getPayloadString(suggestion.payload, "name") ||
    getPayloadString(suggestion.payload, "externalSourceId") ||
    suggestion.facilityId ||
    "—"
  );
}

function getProfessionalLabel(suggestion: RegistrySuggestion): string {
  const firstName = getPayloadString(suggestion.payload, "firstName");
  const lastName = getPayloadString(suggestion.payload, "lastName");
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return getPayloadString(suggestion.payload, "doctorExternalSourceId") || suggestion.professionalId || "—";
}

export default function RegistrySuggestionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<RegistrySuggestion[]>([]);
  const [demoResult, setDemoResult] = useState<RegistryDemoResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningDemo, setRunningDemo] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await registryApi.getSuggestions({
        status: "PENDING",
        limit: 100,
      });
      setSuggestions(response.data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load registry suggestions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const handleApprove = async (id: string) => {
    try {
      await registryApi.approveSuggestion(id);
      toast({ title: "Approved", description: "Suggestion approved" });
      await loadSuggestions();
    } catch {
      toast({ title: "Error", description: "Failed to approve suggestion", variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await registryApi.rejectSuggestion(id);
      toast({ title: "Rejected", description: "Suggestion rejected" });
      await loadSuggestions();
    } catch {
      toast({ title: "Error", description: "Failed to reject suggestion", variant: "destructive" });
    }
  };

  const handleRunDemo = async () => {
    setRunningDemo(true);
    try {
      const result = await registryApi.runDemoScenario();
      setDemoResult(result);
      setSuggestions(result.pendingSuggestions);
      toast({
        title: "Demo scenario complete",
        description: `${result.summary.pendingCount} pending suggestion(s) generated`,
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to run demo scenario",
        variant: "destructive",
      });
    } finally {
      setRunningDemo(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registry Suggestions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review source-driven clinic and facility-professional changes before applying them
          </p>
        </div>
        {hasMinimumRole(user.role.name, "ADMIN") && (
          <Button onClick={handleRunDemo} disabled={runningDemo}>
            {runningDemo ? "Running demo..." : "Run demo scenario"}
          </Button>
        )}
      </div>

      {hasMinimumRole(user.role.name, "ADMIN") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mock ingestion demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>
              Click <strong>Run demo scenario</strong> to reset mock registry data and replay three
              snapshots:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Load baseline clinics and doctors</li>
              <li>Remove Alpha Medical Center from the source feed</li>
              <li>Drop John Doe&apos;s link to Alpha Medical Center</li>
            </ol>
            <p>
              That produces pending suggestions you can approve or reject below without touching real
              data outside the mock provider.
            </p>
          </CardContent>
        </Card>
      )}

      {demoResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last demo run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {demoResult.summary.pendingCount} pending
              </Badge>
              <Badge variant="outline">
                {demoResult.summary.clinicRemovals} clinic removal
                {demoResult.summary.clinicRemovals === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {demoResult.summary.doctorClinicRemovals} facility-professional removal
                {demoResult.summary.doctorClinicRemovals === 1 ? "" : "s"}
              </Badge>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              {demoResult.steps.map((step) => (
                <li key={step.fixture}>
                  {step.skipped ? (
                    <span>{step.label} — skipped ({step.reason})</span>
                  ) : (
                    <span>
                      {step.label}
                      {typeof step.suggestionsCreated === "number" &&
                        step.suggestionsCreated > 0 &&
                        ` — ${step.suggestionsCreated} suggestion(s) created`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-white">
        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading suggestions...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Clinic</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Suggested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                    No pending suggestions. Run the demo scenario to generate sample items.
                  </TableCell>
                </TableRow>
              ) : (
                suggestions.map((suggestion) => (
                  <TableRow key={suggestion.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {TYPE_LABELS[suggestion.type] ?? suggestion.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{suggestion.reason || "—"}</TableCell>
                    <TableCell>{getFacilityLabel(suggestion)}</TableCell>
                    <TableCell>{getProfessionalLabel(suggestion)}</TableCell>
                    <TableCell>{new Date(suggestion.suggestedAt).toLocaleString()}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" onClick={() => handleApprove(suggestion.id)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(suggestion.id)}
                      >
                        Reject
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
