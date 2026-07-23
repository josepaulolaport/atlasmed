"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { FacilityPurchaseProfileFields } from "@/components/facilities/facility-purchase-profile-fields";
import {
  formatPurchaseDate,
  getDefaultPurchaseRecurrence,
  getInitialPurchaseProfileSelection,
  getPurchaseFunnelStagePresentation,
  getPurchaseProfileLabel,
  getPurchaseRecurrenceCommand,
  getPurchaseSourceLabel,
  PURCHASE_PROFILE_OPTIONS,
  purchaseProfileSelectionChanged,
  type PurchaseProfileSelection,
} from "@/components/facilities/purchase-recurrence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api/errors";
import { facilitiesApi } from "@/lib/api/facilities";
import { mapsApi } from "@/lib/api/maps";
import { canManageFacilities, canReadFacilities } from "@/lib/permissions";
import { useTerritoryLabels } from "@/components/territory/territory-picker";
import type {
  Facility,
  FacilityPurchaseProfileFilter,
  FacilitySort,
  FacilitySortOrder,
  PurchaseFunnelStage,
} from "@/types/facility";

const STAGE_OPTIONS: Array<{ value: PurchaseFunnelStage; label: string }> = [
  { value: "NEVER_PURCHASED", label: "Nunca comprou" },
  { value: "OUTSIDE_WINDOW", label: "Fora do período" },
  { value: "PURCHASE_WINDOW", label: "Período de compra" },
  { value: "CHURN", label: "Risco de churn" },
  { value: "INACTIVE", label: "Inativo" },
];

const SORT_OPTIONS: Array<{ value: Exclude<FacilitySort, "distance">; label: string }> = [
  { value: "name", label: "Nome" },
  { value: "purchaseFunnelStage", label: "Etapa de compras" },
  { value: "purchaseIntervalDays", label: "Intervalo" },
  { value: "lastPurchaseDate", label: "Última compra" },
  { value: "relevance", label: "Relevância" },
];

function territoryStatusBadge(status?: Facility["territoryAssignmentStatus"]) {
  if (!status || status === "assigned") return null;
  const label = status === "ambiguous" ? "Ambíguo" : "Não atribuído";
  return <Badge variant={status === "ambiguous" ? "secondary" : "outline"}>{label}</Badge>;
}

function FacilitiesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getLabel } = useTerritoryLabels();
  const canRead = user ? canReadFacilities(user.role.name) : false;
  const canManage = user ? canManageFacilities(user.role.name) : false;

  const querySearch = searchParams.get("search") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const stage = (searchParams.get("stage") ?? "all") as PurchaseFunnelStage | "all";
  const profile = (searchParams.get("profile") ?? "all") as FacilityPurchaseProfileFilter | "all";
  const requestedSort = (searchParams.get("sort") ?? (querySearch ? "relevance" : "name")) as FacilitySort;
  const sort = requestedSort === "relevance" && !querySearch ? "name" : requestedSort;
  const order = (searchParams.get("order") ?? (sort === "relevance" ? "desc" : "asc")) as FacilitySortOrder;
  const editId = searchParams.get("edit");

  const [searchInput, setSearchInput] = useState(querySearch);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formStateCode, setFormStateCode] = useState("");
  const [formCnpj, setFormCnpj] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [purchaseProfile, setPurchaseProfile] = useState<PurchaseProfileSelection>("AUTOMATIC");
  const [initialPurchaseProfile, setInitialPurchaseProfile] = useState<PurchaseProfileSelection>("AUTOMATIC");
  const [customInterval, setCustomInterval] = useState("");
  const [initialCustomInterval, setInitialCustomInterval] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateQuery = useCallback((changes: Record<string, string | number | null>, replace = false) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") next.delete(key);
      else next.set(key, String(value));
    });
    const href = next.size ? `/facilities?${next.toString()}` : "/facilities";
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => setSearchInput(querySearch), [querySearch]);

  useEffect(() => {
    if (searchInput === querySearch) return;
    const timeout = window.setTimeout(() => {
      updateQuery({ search: searchInput.trim() || null, page: null, sort: null, order: null }, true);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [querySearch, searchInput, updateQuery]);

  useEffect(() => {
    if (user && !canRead) router.replace("/unauthorized");
  }, [user, canRead, router]);

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    facilitiesApi.getFacilities({
      page,
      limit: 12,
      search: querySearch || undefined,
      purchaseFunnelStage: stage === "all" ? undefined : stage,
      purchaseProfile: profile === "all" ? undefined : profile,
      sort,
      order,
      signal: controller.signal,
    }).then((response) => {
      setFacilities(response.data);
      setTotal(response.pagination.total);
      setTotalPages(Math.max(1, response.pagination.totalPages));
    }).catch((error) => {
      if (controller.signal.aborted) return;
      const message = getApiErrorMessage(error, "Falha ao carregar unidades");
      setLoadError(message);
      toast({ title: "Erro ao carregar unidades", description: message, variant: "destructive" });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [canRead, order, page, profile, querySearch, refreshKey, sort, stage]);

  const initializeForm = useCallback((facility: Facility | null) => {
    setEditingFacility(facility);
    setFormName(facility?.name ?? "");
    setFormAddress(facility?.address ?? "");
    setFormCity(facility?.city ?? "");
    setFormStateCode(facility?.stateCode ?? "");
    setFormCnpj(facility?.cnpj ?? "");
    setFormLat(facility?.lat != null ? String(facility.lat) : "");
    setFormLng(facility?.lng != null ? String(facility.lng) : "");
    const recurrence = facility?.purchaseRecurrence ?? getDefaultPurchaseRecurrence();
    const selection = getInitialPurchaseProfileSelection(recurrence.profile);
    const interval = selection === "CUSTOM" ? String(recurrence.intervalDays) : "";
    setPurchaseProfile(selection);
    setInitialPurchaseProfile(selection);
    setCustomInterval(interval);
    setInitialCustomInterval(interval);
    setSaveError(null);
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (!editId || !canManage) return;
    const onPage = facilities.find((facility) => facility.id === editId);
    if (onPage) {
      if (!dialogOpen || editingFacility?.id !== editId) initializeForm(onPage);
      return;
    }
    let active = true;
    facilitiesApi.getFacility(editId).then((facility) => {
      if (active) initializeForm(facility);
    }).catch((error) => {
      if (!active) return;
      toast({
        title: "Não foi possível abrir a edição",
        description: getApiErrorMessage(error, "Falha ao carregar unidade"),
        variant: "destructive",
      });
      updateQuery({ edit: null }, true);
    });
    return () => { active = false; };
  }, [canManage, dialogOpen, editId, editingFacility?.id, facilities, initializeForm, updateQuery]);

  const setDialogState = (open: boolean) => {
    setDialogOpen(open);
    if (!open && editId) updateQuery({ edit: null }, true);
  };

  const openEditDialog = (facility: Facility) => updateQuery({ edit: facility.id });
  const openCreateDialog = () => initializeForm(null);

  const parseCoordinate = (value: string): number | null | undefined => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleGeocodeAddress = async () => {
    if (!formAddress.trim()) {
      toast({ title: "Validação", description: "Informe um endereço para geocodificar", variant: "destructive" });
      return;
    }
    setGeocoding(true);
    try {
      const result = await mapsApi.forwardGeocode(formAddress.trim());
      if (!result) {
        toast({ title: "Endereço não encontrado", description: "Não foi possível localizar as coordenadas", variant: "destructive" });
        return;
      }
      setFormLat(String(result.latitude));
      setFormLng(String(result.longitude));
      toast({ title: "Endereço geocodificado", description: "As coordenadas foram preenchidas", variant: "success" });
    } catch {
      toast({ title: "Erro", description: "A geocodificação falhou. Verifique a configuração do Mapbox.", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!formName.trim()) {
      setSaveError("O nome é obrigatório.");
      return;
    }
    const lat = parseCoordinate(formLat);
    const lng = parseCoordinate(formLng);
    if (lat === undefined || lng === undefined) {
      setSaveError("Latitude e longitude devem ser números válidos quando informados.");
      return;
    }
    if (lat == null && lng == null && !formAddress.trim()) {
      setSaveError("Informe um endereço ou coordenadas.");
      return;
    }

    const recurrenceChanged = purchaseProfileSelectionChanged(
      initialPurchaseProfile,
      purchaseProfile,
      initialCustomInterval,
      customInterval,
    );
    const recurrenceCommand = recurrenceChanged
      ? getPurchaseRecurrenceCommand(purchaseProfile, customInterval)
      : null;
    if (recurrenceChanged && !recurrenceCommand) {
      setSaveError("O intervalo personalizado deve ser um número inteiro entre 1 e 3.650 dias.");
      return;
    }

    setSaving(true);
    try {
      if (!editingFacility) {
        const created = await facilitiesApi.createFacility({
          name: formName.trim(),
          address: formAddress.trim() || undefined,
          city: formCity.trim() || undefined,
          stateCode: formStateCode.trim() || undefined,
          cnpj: formCnpj.trim() || undefined,
          lat: lat ?? undefined,
          lng: lng ?? undefined,
        });
        if (recurrenceCommand) {
          try {
            await facilitiesApi.updateFacility(created.id, { purchaseRecurrence: recurrenceCommand });
          } catch (error) {
            const message = getApiErrorMessage(error, "Falha ao configurar o perfil de compras");
            toast({ title: "Criação parcial", description: "A unidade usa o perfil automático até a configuração ser concluída.", variant: "destructive" });
            initializeForm(await facilitiesApi.getFacility(created.id));
            setSaveError(`A unidade foi criada, mas o perfil de compras não foi configurado: ${message}`);
            setRefreshKey((value) => value + 1);
            return;
          }
        }
      } else {
        const locationChanged = lat !== (editingFacility.lat ?? null) || lng !== (editingFacility.lng ?? null);
        const nameChanged = formName.trim() !== editingFacility.name;
        if (nameChanged || locationChanged) {
          await facilitiesApi.updateFacility(editingFacility.id, {
            ...(nameChanged ? { name: formName.trim() } : {}),
            ...(locationChanged ? { lat, lng } : {}),
          });
        }
        if (recurrenceCommand) {
          try {
            await facilitiesApi.updateFacility(editingFacility.id, { purchaseRecurrence: recurrenceCommand });
          } catch (error) {
            const message = getApiErrorMessage(error, "Falha ao atualizar o perfil de compras");
            toast({ title: "Atualização parcial", description: "Revise o perfil de compras e tente novamente.", variant: "destructive" });
            const reloaded = await facilitiesApi.getFacility(editingFacility.id);
            initializeForm(reloaded);
            setSaveError(`Os dados da unidade foram salvos, mas o perfil de compras não foi atualizado: ${message}`);
            return;
          }
        }
      }
      toast({
        title: editingFacility ? "Unidade atualizada" : "Unidade criada",
        description: editingFacility ? "As alterações foram salvas." : "A unidade foi cadastrada com perfil automático.",
        variant: "success",
      });
      setDialogState(false);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      const message = getApiErrorMessage(error, "Falha ao salvar unidade");
      setSaveError(message);
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (facility: Facility) => {
    if (!confirm(`Excluir a unidade “${facility.name}”?`)) return;
    try {
      await facilitiesApi.deleteFacility(facility.id);
      toast({ title: "Unidade excluída", variant: "success" });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast({ title: "Erro ao excluir", description: getApiErrorMessage(error, "Falha ao excluir unidade"), variant: "destructive" });
    }
  };

  const hasFilters = Boolean(querySearch || stage !== "all" || profile !== "all");
  const profileOptions = useMemo(() => PURCHASE_PROFILE_OPTIONS.map((item) => ({ value: item.value, label: item.days ? `${item.label} — ${item.days} dias` : item.label })), []);

  if (!canRead) return null;

  return (
    <>
      <header className="border-b border-zinc-100 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-900">Unidades de saúde</h1>
            <p className="mt-1 text-sm text-zinc-500">Acompanhe território, profissionais e recorrência de compras.</p>
          </div>
          {canManage && <Button onClick={openCreateDialog}><Plus />Adicionar unidade</Button>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
        <section aria-label="Filtros de unidades" className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(150px,1fr))]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input aria-label="Buscar unidades" placeholder="Buscar por nome ou endereço…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-8" />
            </div>
            <Select value={stage} onValueChange={(value) => updateQuery({ stage: value, page: null })}>
              <SelectTrigger aria-label="Filtrar por etapa"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as etapas</SelectItem>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={profile} onValueChange={(value) => updateQuery({ profile: value, page: null })}>
              <SelectTrigger aria-label="Filtrar por perfil"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os perfis</SelectItem>{profileOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => updateQuery({ sort: value, order: value === "relevance" ? "desc" : order, page: null })}>
              <SelectTrigger aria-label="Ordenar unidades"><SelectValue /></SelectTrigger>
              <SelectContent>{SORT_OPTIONS.filter((item) => item.value !== "relevance" || querySearch).map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={order} onValueChange={(value) => updateQuery({ order: value, page: null })}>
              <SelectTrigger aria-label="Direção da ordenação"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="asc">Crescente</SelectItem><SelectItem value="desc">Decrescente</SelectItem></SelectContent>
            </Select>
          </div>
        </section>

        {loadError && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span><Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>Tentar novamente</Button>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
        ) : facilities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
            <h2 className="text-sm font-medium text-zinc-900">{hasFilters ? "Nenhuma unidade corresponde aos filtros" : "Nenhuma unidade cadastrada"}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{hasFilters ? "Ajuste a busca, a etapa ou o perfil para ampliar os resultados." : "Cadastre a primeira unidade para começar a acompanhar compras e territórios."}</p>
            {hasFilters && <Button className="mt-4" variant="outline" onClick={() => router.push("/facilities")}>Limpar filtros</Button>}
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-500">{total} {total === 1 ? "unidade encontrada" : "unidades encontradas"}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {facilities.map((facility) => {
                const recurrence = facility.purchaseRecurrence ?? getDefaultPurchaseRecurrence();
                const funnel = getPurchaseFunnelStagePresentation(recurrence.funnelStage);
                return (
                  <article key={facility.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className="border-b border-zinc-200 bg-zinc-50/50 px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Badge variant={funnel.variant} className="mb-2">{funnel.label}</Badge>
                          <Link href={`/facilities/${facility.id}`} className="block truncate text-lg font-semibold text-zinc-900 transition-colors hover:text-blue-600">{facility.name}</Link>
                          <p className="mt-1 truncate text-xs text-zinc-500">Consultor: <span className="font-medium text-zinc-800">{facility.consultantName ?? "Não atribuído"}</span></p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm font-medium text-zinc-700" title="Profissionais vinculados"><Users className="h-3.5 w-3.5" />{facility.professionalCount ?? 0}</span>
                          {canManage && <><Button variant="ghost" size="icon" title="Editar unidade" aria-label={`Editar ${facility.name}`} onClick={() => openEditDialog(facility)}><Pencil /></Button><Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" title="Excluir unidade" aria-label={`Excluir ${facility.name}`} onClick={() => handleDelete(facility)}><Trash2 /></Button></>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3 text-sm">
                        <div><p className="text-xs text-zinc-500">Perfil</p><p className="mt-0.5 font-medium text-zinc-900">{getPurchaseProfileLabel(recurrence.profile)}</p></div>
                        <div><p className="text-xs text-zinc-500">Fonte</p><p className="mt-0.5 font-medium text-zinc-900">{getPurchaseSourceLabel(recurrence.source)}</p></div>
                        <div><p className="text-xs text-zinc-500">Recorrência</p><p className="mt-0.5 font-medium text-zinc-900">Intervalo: {recurrence.intervalDays} dias</p></div>
                        <div><p className="text-xs text-zinc-500">Última compra</p><p className="mt-0.5 font-medium text-zinc-900">{formatPurchaseDate(recurrence.lastPurchaseDate)}</p></div>
                      </div>
                      {facility.address && <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" /><p className="text-sm text-zinc-700">{facility.address}</p></div>}
                      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                        {facility.territoryId ? <><span>Território: <strong className="font-medium text-zinc-900">{getLabel(facility.territoryId)}</strong></span>{territoryStatusBadge(facility.territoryAssignmentStatus)}</> : <span>Sem território atribuído</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <nav aria-label="Paginação de unidades" className="mt-6 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })}>Anterior</Button>
              <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => updateQuery({ page: page + 1 })}>Próxima</Button>
            </nav>
          </>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogState}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editingFacility ? "Editar unidade" : "Criar unidade"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {saveError && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saveError}</div>}
            <div><Label htmlFor="facility-name">Nome</Label><Input id="facility-name" value={formName} onChange={(event) => setFormName(event.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="facility-cnpj">CNPJ</Label><Input id="facility-cnpj" value={formCnpj} onChange={(event) => setFormCnpj(event.target.value)} placeholder="00.000.000/0000-00" disabled={Boolean(editingFacility)} /></div><div><Label htmlFor="facility-state">Estado (UF)</Label><Input id="facility-state" value={formStateCode} onChange={(event) => setFormStateCode(event.target.value)} maxLength={2} disabled={Boolean(editingFacility)} /></div></div>
            <div><Label htmlFor="facility-address">{editingFacility ? "Endereço para geocodificação" : "Endereço"}</Label><div className="flex flex-col gap-2 sm:flex-row"><Input id="facility-address" value={formAddress} onChange={(event) => setFormAddress(event.target.value)} /><Button type="button" variant="outline" onClick={handleGeocodeAddress} disabled={geocoding}>{geocoding ? "Geocodificando…" : "Geocodificar"}</Button></div>{editingFacility && <p className="mt-1 text-xs text-zinc-500">Na edição, o endereço é usado para preencher coordenadas. O contrato atual salva nome e coordenadas.</p>}</div>
            {!editingFacility && <div><Label htmlFor="facility-city">Cidade</Label><Input id="facility-city" value={formCity} onChange={(event) => setFormCity(event.target.value)} /></div>}
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="facility-lat">Latitude</Label><Input id="facility-lat" type="number" step="any" value={formLat} onChange={(event) => setFormLat(event.target.value)} /></div><div><Label htmlFor="facility-lng">Longitude</Label><Input id="facility-lng" type="number" step="any" value={formLng} onChange={(event) => setFormLng(event.target.value)} /></div></div>
            <FacilityPurchaseProfileFields value={purchaseProfile} customInterval={customInterval} onValueChange={setPurchaseProfile} onCustomIntervalChange={setCustomInterval} recurrence={editingFacility ? editingFacility.purchaseRecurrence ?? getDefaultPurchaseRecurrence() : undefined} disabled={saving} />
            {!editingFacility && <p className="text-xs text-zinc-500">O perfil automático não envia configuração adicional. Se você escolher outro perfil, ele será aplicado logo após a criação.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogState(false)}>Cancelar</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : editingFacility ? "Salvar alterações" : "Criar unidade"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function FacilitiesPage() {
  return <Suspense fallback={<div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>}><FacilitiesPageContent /></Suspense>;
}
