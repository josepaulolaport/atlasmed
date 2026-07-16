"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { facilitiesApi } from "@/lib/api/facilities";
import { facilityProfessionalsApi } from "@/lib/api/facility-professionals";
import { professionalsApi } from "@/lib/api/professionals";
import { registryApi } from "@/lib/api/registry";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useTerritoryLabels } from "@/components/territory/territory-picker";
import type {
  Facility,
  FacilityProfessionalListItem,
  Professional,
  FacilityProfessionalView,
  RegistrySuggestion,
  Interaction,
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
import { TabBar as Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDateTime } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type TabKey =
  | "overview"
  | "interactions"
  | "professionals"
  | "registry"
  | "territory";

const VIEWS: { value: FacilityProfessionalView; label: string }[] = [
  { value: "all", label: "Todos ativos" },
  { value: "source", label: "Origem" },
  { value: "confirmed", label: "Confirmado" },
  { value: "pending", label: "Confirmação pendente" },
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
  const { getLabel: getTerritoryLabel } = useTerritoryLabels();

  const loadFacility = useCallback(async () => {
    try {
      const data = await facilitiesApi.getFacility(facilityId);
      setFacility(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao carregar unidade"),
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
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao carregar profissionais"),
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
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao carregar sugestões"),
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
      toast({ title: "Confirmado", description: "Profissional confirmado na unidade" });
      await loadProfessionals();
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao confirmar profissional"),
        variant: "destructive",
      });
    }
  };

  const handleAssociate = async () => {
    if (!associateProfessionalId) return;
    try {
      await facilityProfessionalsApi.associateProfessional(facilityId, associateProfessionalId);
      toast({ title: "Associado", description: "Profissional vinculado à unidade" });
      setAssociateProfessionalId("");
      await loadProfessionals();
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao associar profissional"),
        variant: "destructive",
      });
    }
  };

  const handleEndAssociation = async (professionalId: string) => {
    if (!confirm("Remover este profissional da lista da unidade?")) return;
    try {
      await facilityProfessionalsApi.endAssociation(facilityId, professionalId);
      toast({ title: "Removido", description: "Associação encerrada" });
      await loadProfessionals();
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao encerrar associação"),
        variant: "destructive",
      });
    }
  };

  const handleApproveSuggestion = async (id: string) => {
    try {
      await registryApi.approveSuggestion(id);
      toast({ title: "Aprovado", description: "Sugestão de cadastro aplicada" });
      await Promise.all([loadSuggestions(), loadProfessionals(), loadFacility()]);
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao aprovar sugestão"),
        variant: "destructive",
      });
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      await registryApi.rejectSuggestion(id);
      toast({ title: "Descartado", description: "Sugestão rejeitada" });
      await loadSuggestions();
    } catch (error) {
      toast({
        title: "Erro",
        description: getApiErrorMessage(error, "Falha ao rejeitar sugestão"),
        variant: "destructive",
      });
    }
  };

  const tabs = useMemo<TabItem[]>(
    () => [
      { value: "overview", label: "Visão geral" },
      { value: "interactions", label: "Interações" },
      {
        value: "professionals",
        label: "Profissionais",
        badge: professionals.length ? String(professionals.length) : undefined,
        badgeVariant: "muted",
      },
      {
        value: "registry",
        label: "Cadastro",
        badge: suggestions.length ? `${suggestions.length} atualizações` : undefined,
        badgeVariant: "info",
      },
      { value: "territory", label: "Território" },
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
      <div className="p-6 text-sm text-zinc-500">Unidade não encontrada.</div>
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
              {facility.address || "Nenhum endereço cadastrado"}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <iconify-icon
                  icon="solar:map-point-linear"
                  stroke-width="1.5"
                  className="mr-1.5"
                />
                Território:{" "}
                {facility.territoryId
                  ? getTerritoryLabel(facility.territoryId)
                  : "Não atribuído"}
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
                Conformidade:{" "}
                {territoryStatus === "assigned" ? "Validado" : "Revisão"}
              </Badge>
              {pendingSuggestionCount > 0 && (
                <Badge variant="warning">
                  <iconify-icon
                    icon="solar:inbox-in-linear"
                    stroke-width="1.5"
                    className="mr-1.5"
                  />
                  {pendingSuggestionCount}{" "}
                  {pendingSuggestionCount === 1
                    ? "Sugestão Pendente"
                    : "Sugestões Pendentes"}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="default" asChild>
              <Link href={`/facilities`}>
                <iconify-icon icon="solar:arrow-left-linear" stroke-width="1.5" />
                Voltar
              </Link>
            </Button>
            <Button variant="outline" size="default">
              <iconify-icon icon="solar:pen-linear" stroke-width="1.5" />
              Editar
            </Button>
            <Button variant="outline" size="default">
              <iconify-icon icon="solar:map-linear" stroke-width="1.5" />
              Ver mapa
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

      {activeTab === "interactions" && <InteractionsTab facilityId={facilityId} />}

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
                Detalhes da unidade
              </h3>
            </div>
            <div className="p-5 grid grid-cols-2 gap-6">
              <Field label="Nome" value={facility.name} />
              <Field label="ID" value={facility.id} />
              <Field label="Endereço" value={facility.address} />
              <Field
                label="Coordenadas"
                value={
                  facility.lat && facility.lng
                    ? `${facility.lat.toFixed(5)}, ${facility.lng.toFixed(5)}`
                    : undefined
                }
              />
              <Field
                label="Criado em"
                value={new Date(facility.createdAt).toLocaleDateString("pt-BR")}
              />
              <Field
                label="Atualizado em"
                value={new Date(facility.updatedAt).toLocaleDateString("pt-BR")}
              />
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
              <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
                Território
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <Field label="ID do território" value={facility.territoryId} />
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  Status de atribuição
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
          <p className="mb-1 text-xs font-medium text-zinc-500">Visualização</p>
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
              Associar profissional
            </p>
            <Select
              value={associateProfessionalId}
              onValueChange={setAssociateProfessionalId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar profissional" />
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
            Associar
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
            Profissionais associados
            <span className="bg-zinc-100 text-zinc-600 py-0.5 px-2 rounded-full text-xs font-medium">
              {professionals.length}
            </span>
          </h4>
        </div>
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            Carregando profissionais…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professionals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-zinc-500"
                  >
                    Nenhum profissional nesta visualização
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
                        <Badge variant="secondary">Origem</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {row.association.confirmedAt ? (
                        <Badge variant="success">Confirmado</Badge>
                      ) : row.association.pendingConfirmation ? (
                        <Badge variant="warning">Pendente</Badge>
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
                          Confirmar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEnd(row.professional.id)}
                      >
                        Remover
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
          <h4 className="text-sm font-medium text-zinc-900">Revisão de cadastro</h4>
          <p className="text-sm text-zinc-500 mt-1">
            Os dados do CNES são importados e comparados com as informações do
            seu CRM. Aprove ou rejeite as alterações sugeridas abaixo. Suas
            edições manuais estão sempre protegidas e nunca são sobrescritas
            silenciosamente.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          Carregando sugestões…
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <iconify-icon
            icon="solar:check-circle-linear"
            stroke-width="1.5"
            className="text-emerald-500 text-3xl"
          />
          <h4 className="mt-3 text-sm font-medium text-zinc-900">
            Nenhuma sugestão pendente
          </h4>
          <p className="mt-1 text-sm text-zinc-500">
            Esta unidade está sincronizada com o cadastro.
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
    FACILITY_REGISTRY_DEACTIVATED: "Desativação de unidade",
    FACILITY_REGISTRY_REACTIVATED: "Reativação de unidade",
    DOCTOR_FACILITY_REGISTRY_DEACTIVATED: "Remoção de profissional",
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
            Execução #{suggestion.ingestionRunId.slice(0, 8)} •{" "}
            {new Date(suggestion.suggestedAt).toLocaleString("pt-BR")}
          </span>
        </div>
        <Badge variant="secondary">Pendente</Badge>
      </div>

      <div className="p-5">
        <p className="text-sm text-zinc-700">
          {suggestion.reason || "Divergência de cadastro detectada."}
        </p>
        {suggestion.payload && Object.keys(suggestion.payload).length > 0 && (
          <pre className="mt-3 rounded-md bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-600 overflow-auto">
            {JSON.stringify(suggestion.payload, null, 2)}
          </pre>
        )}
      </div>

      <div className="px-5 py-4 border-t border-zinc-200 bg-white flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onReject}>
          Descartar
        </Button>
        <Button onClick={onApprove}>Aplicar sugestão</Button>
      </div>
    </div>
  );
}

function InteractionsTab({ facilityId }: { facilityId: string }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<"followup" | "presentation">("followup");
  const [newSummary, setNewSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const loadInteractions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await facilitiesApi.listInteractions(facilityId, { page, limit: 10 });
      setInteractions(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch {
      toast({ title: "Erro ao carregar interações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [facilityId, page, toast]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  const handleSubmit = async () => {
    if (!newSummary.trim()) return;
    setSubmitting(true);
    try {
      await facilitiesApi.createInteraction(facilityId, {
        type: newType,
        summary: newSummary,
      });
      setNewSummary("");
      setShowForm(false);
      setPage(1);
      await loadInteractions();
      toast({ title: "Interação registrada com sucesso" });
    } catch {
      toast({ title: "Erro ao registrar interação", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900">Interações com a unidade</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Nova interação"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div>
            <Label htmlFor="interaction-type">Tipo</Label>
            <select
              id="interaction-type"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value as "followup" | "presentation")}
            >
              <option value="followup">Follow-up</option>
              <option value="presentation">Apresentação</option>
            </select>
          </div>
          <div>
            <Label htmlFor="interaction-summary">Resumo</Label>
            <Textarea
              id="interaction-summary"
              placeholder="Descreva o que foi tratado na interação..."
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              rows={3}
            />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !newSummary.trim()}>
            {submitting ? "Registrando..." : "Registrar interação"}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
      ) : interactions.length === 0 ? (
        <div className="py-10 text-center text-sm text-zinc-500">
          Nenhuma interação registrada.
        </div>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction) => (
            <div
              key={interaction.id}
              className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  interaction.type === "followup"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-green-50 text-green-700"
                }`}>
                  {interaction.type === "followup" ? "Follow-up" : "Apresentação"}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatDateTime(interaction.interactedAt)}
                </span>
              </div>
              <p className="text-sm text-zinc-900 mb-2">{interaction.summary}</p>
              <p className="text-xs text-zinc-500">{interaction.agentName}</p>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

function TerritoryTab({ facility }: { facility: Facility }) {
  const { getLabel } = useTerritoryLabels();
  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/50">
          <h3 className="text-sm font-medium text-zinc-900 tracking-tight">
            Atribuição geográfica
          </h3>
        </div>
        <div className="p-5 grid grid-cols-2 gap-6">
          <Field label="Território" value={facility.territoryId ? getLabel(facility.territoryId) : undefined} />
          <Field
            label="Status de atribuição"
            value={facility.territoryAssignmentStatus}
          />
          <Field
            label="Coordenadas"
            value={
              facility.lat && facility.lng
                ? `${facility.lat.toFixed(5)}, ${facility.lng.toFixed(5)}`
                : undefined
            }
          />
          <Field label="Endereço" value={facility.address} />
        </div>
      </div>
    </div>
  );
}
