"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { facilitiesApi } from "@/lib/api/facilities";
import { facilityProfessionalsApi } from "@/lib/api/facility-professionals";
import { professionalsApi } from "@/lib/api/professionals";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useTerritoryLabels } from "@/components/territory/territory-picker";
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
import { TabBar as Tabs, type TabItem } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TabKey =
  | "overview"
  | "professionals"
  | "territory";

const VIEWS: { value: FacilityProfessionalView; label: string }[] = [
  { value: "all", label: "Todos ativos" },
  { value: "confirmed", label: "Confirmado" },
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


  const tabs = useMemo<TabItem[]>(
    () => [
      { value: "overview", label: "Visão geral" },
      {
        value: "professionals",
        label: "Profissionais",
        badge: professionals.length ? String(professionals.length) : undefined,
        badgeVariant: "muted",
      },
      { value: "territory", label: "Território" },
    ],
    [professionals.length]
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
          onEnd={handleEndAssociation}
          loading={loadingProfessionals}
        />
      )}


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
                  <SelectItem key={professional.id} value={String(professional.id)}>
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professionals.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
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
                      {row.association.confirmedAt ? (
                        <Badge variant="success">Confirmado</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
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
