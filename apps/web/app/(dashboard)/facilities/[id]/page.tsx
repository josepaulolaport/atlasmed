'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTerritoryLabels } from '@/components/territory/territory-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { type TabItem, TabBar as Tabs } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { facilitiesApi } from '@/lib/api/facilities'
import { facilityProfessionalsApi } from '@/lib/api/facility-professionals'
import { professionalsApi } from '@/lib/api/professionals'
import { registryApi } from '@/lib/api/registry'
import { cn } from '@/lib/utils'
import type {
  Facility,
  FacilityProfessionalListItem,
  FacilityProfessionalView,
  Professional,
  RegistrySuggestion
} from '@/types/facility'

type TabKey = 'overview' | 'professionals' | 'registry' | 'territory'

const VIEWS: { value: FacilityProfessionalView; label: string }[] = [
  { value: 'all', label: 'Todos ativos' },
  { value: 'source', label: 'Origem' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'pending', label: 'Confirmação pendente' }
]

export default function FacilityDetailPage() {
  const params = useParams<{ id: string }>()
  const facilityId = params.id
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [facility, setFacility] = useState<Facility | null>(null)
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<FacilityProfessionalView>('all')
  const [professionals, setProfessionals] = useState<FacilityProfessionalListItem[]>([])
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([])
  const [associateProfessionalId, setAssociateProfessionalId] = useState('')
  const [loadingProfessionals, setLoadingProfessionals] = useState(false)

  const [suggestions, setSuggestions] = useState<RegistrySuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const { getLabel: getTerritoryLabel } = useTerritoryLabels()

  const loadFacility = useCallback(async () => {
    try {
      const data = await facilitiesApi.getFacility(facilityId)
      setFacility(data)
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao carregar unidade'),
        variant: 'destructive'
      })
    }
  }, [facilityId, toast])

  const loadProfessionals = useCallback(async () => {
    setLoadingProfessionals(true)
    try {
      const response = await facilityProfessionalsApi.listProfessionals(facilityId, {
        view,
        limit: 100
      })
      setProfessionals(response.data)
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao carregar profissionais'),
        variant: 'destructive'
      })
    } finally {
      setLoadingProfessionals(false)
    }
  }, [facilityId, view, toast])

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true)
    try {
      const response = await registryApi.getSuggestions({
        status: 'PENDING',
        limit: 100
      })
      setSuggestions(response.data.filter((s) => s.facilityId === facilityId))
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao carregar sugestões'),
        variant: 'destructive'
      })
    } finally {
      setLoadingSuggestions(false)
    }
  }, [facilityId, toast])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await loadFacility()
      setLoading(false)
    })()
  }, [loadFacility])

  useEffect(() => {
    void loadProfessionals()
  }, [loadProfessionals])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  useEffect(() => {
    void professionalsApi.getProfessionals({ limit: 100 }).then((response) => {
      setAllProfessionals(response.data)
    })
  }, [])

  const handleConfirm = async (professionalId: string) => {
    try {
      await facilityProfessionalsApi.confirmProfessional(facilityId, professionalId)
      toast({ title: 'Confirmado', description: 'Profissional confirmado na unidade' })
      await loadProfessionals()
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao confirmar profissional'),
        variant: 'destructive'
      })
    }
  }

  const handleAssociate = async () => {
    if (!associateProfessionalId) return
    try {
      await facilityProfessionalsApi.associateProfessional(facilityId, associateProfessionalId)
      toast({ title: 'Associado', description: 'Profissional vinculado à unidade' })
      setAssociateProfessionalId('')
      await loadProfessionals()
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao associar profissional'),
        variant: 'destructive'
      })
    }
  }

  const handleEndAssociation = async (professionalId: string) => {
    if (!confirm('Remover este profissional da lista da unidade?')) return
    try {
      await facilityProfessionalsApi.endAssociation(facilityId, professionalId)
      toast({ title: 'Removido', description: 'Associação encerrada' })
      await loadProfessionals()
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao encerrar associação'),
        variant: 'destructive'
      })
    }
  }

  const handleApproveSuggestion = async (id: string) => {
    try {
      await registryApi.approveSuggestion(id)
      toast({ title: 'Aprovado', description: 'Sugestão de cadastro aplicada' })
      await Promise.all([loadSuggestions(), loadProfessionals(), loadFacility()])
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao aprovar sugestão'),
        variant: 'destructive'
      })
    }
  }

  const handleRejectSuggestion = async (id: string) => {
    try {
      await registryApi.rejectSuggestion(id)
      toast({ title: 'Descartado', description: 'Sugestão rejeitada' })
      await loadSuggestions()
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao rejeitar sugestão'),
        variant: 'destructive'
      })
    }
  }

  const tabs = useMemo<TabItem[]>(
    () => [
      { value: 'overview', label: 'Visão geral' },
      {
        value: 'professionals',
        label: 'Profissionais',
        badge: professionals.length ? String(professionals.length) : undefined,
        badgeVariant: 'muted'
      },
      {
        value: 'registry',
        label: 'Cadastro',
        badge: suggestions.length ? `${suggestions.length} atualizações` : undefined,
        badgeVariant: 'info'
      },
      { value: 'territory', label: 'Território' }
    ],
    [professionals.length, suggestions.length]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!facility) {
    return <div className="p-6 text-sm text-zinc-500">Unidade não encontrada.</div>
  }

  const territoryStatus = facility.territoryAssignmentStatus
  const pendingSuggestionCount = suggestions.length

  return (
    <>
      <div className="border-zinc-100 border-b px-6 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1 className="font-medium text-2xl text-zinc-900 tracking-tight">{facility.name}</h1>
              <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-medium text-xs text-zinc-600">
                ID: {facility.id.slice(0, 8)}
              </span>
            </div>
            <p className="mb-4 text-sm text-zinc-500">
              {facility.address || 'Nenhum endereço cadastrado'}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <iconify-icon icon="solar:map-point-linear" stroke-width="1.5" className="mr-1.5" />
                Território:{' '}
                {facility.territoryId ? getTerritoryLabel(facility.territoryId) : 'Não atribuído'}
              </Badge>
              <Badge variant={territoryStatus === 'assigned' ? 'success' : 'warning'}>
                <iconify-icon
                  icon="solar:shield-check-linear"
                  stroke-width="1.5"
                  className="mr-1.5"
                />
                Conformidade: {territoryStatus === 'assigned' ? 'Validado' : 'Revisão'}
              </Badge>
              {pendingSuggestionCount > 0 && (
                <Badge variant="warning">
                  <iconify-icon
                    icon="solar:inbox-in-linear"
                    stroke-width="1.5"
                    className="mr-1.5"
                  />
                  {pendingSuggestionCount}{' '}
                  {pendingSuggestionCount === 1 ? 'Sugestão Pendente' : 'Sugestões Pendentes'}
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

      <Tabs items={tabs} value={activeTab} onChange={(v) => setActiveTab(v as TabKey)} />

      {activeTab === 'overview' && <OverviewTab facility={facility} />}

      {activeTab === 'professionals' && (
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

      {activeTab === 'registry' && (
        <RegistryTab
          suggestions={suggestions}
          loading={loadingSuggestions}
          onApprove={handleApproveSuggestion}
          onReject={handleRejectSuggestion}
        />
      )}

      {activeTab === 'territory' && <TerritoryTab facility={facility} />}
    </>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="mb-1 block font-medium text-xs text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-900">{value || '—'}</div>
    </div>
  )
}

function OverviewTab({ facility }: { facility: Facility }) {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
              <h3 className="font-medium text-sm text-zinc-900 tracking-tight">
                Detalhes da unidade
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-6 p-5">
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
                value={new Date(facility.createdAt).toLocaleDateString('pt-BR')}
              />
              <Field
                label="Atualizado em"
                value={new Date(facility.updatedAt).toLocaleDateString('pt-BR')}
              />
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
              <h3 className="font-medium text-sm text-zinc-900 tracking-tight">Território</h3>
            </div>
            <div className="space-y-4 p-5">
              <Field label="ID do território" value={facility.territoryId} />
              <div>
                <div className="mb-1 block font-medium text-xs text-zinc-500">
                  Status de atribuição
                </div>
                {facility.territoryAssignmentStatus ? (
                  <Badge
                    variant={
                      facility.territoryAssignmentStatus === 'assigned'
                        ? 'success'
                        : facility.territoryAssignmentStatus === 'ambiguous'
                          ? 'warning'
                          : 'secondary'
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
  )
}

interface ProfessionalsTabProps {
  facilityId: string
  view: FacilityProfessionalView
  setView: (v: FacilityProfessionalView) => void
  professionals: FacilityProfessionalListItem[]
  allProfessionals: Professional[]
  associateProfessionalId: string
  setAssociateProfessionalId: (id: string) => void
  onAssociate: () => void
  onConfirm: (id: string) => void
  onEnd: (id: string) => void
  loading: boolean
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
  loading
}: ProfessionalsTabProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <p className="mb-1 font-medium text-xs text-zinc-500">Visualização</p>
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
            <p className="mb-1 font-medium text-xs text-zinc-500">Associar profissional</p>
            <Select value={associateProfessionalId} onValueChange={setAssociateProfessionalId}>
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

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
          <h4 className="flex items-center gap-2 font-medium text-sm text-zinc-900">
            <iconify-icon
              icon="solar:stethoscope-linear"
              stroke-width="1.5"
              className="text-zinc-400"
            />
            Profissionais associados
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-xs text-zinc-600">
              {professionals.length}
            </span>
          </h4>
        </div>
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">Carregando profissionais…</div>
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
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">
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
                    <TableCell>{row.professional.specialty || '—'}</TableCell>
                    <TableCell>
                      {row.association.sourceActive ? (
                        <Badge variant="secondary">Origem</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {row.association.confirmedAt ? (
                        <Badge variant="success">Confirmado</Badge>
                      ) : row.association.pendingConfirmation ? (
                        <Badge variant="warning">Pendente</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {row.association.pendingConfirmation && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onConfirm(row.professional.id)}
                        >
                          Confirmar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onEnd(row.professional.id)}>
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
  )
}

interface RegistryTabProps {
  suggestions: RegistrySuggestion[]
  loading: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

function RegistryTab({ suggestions, loading, onApprove, onReject }: RegistryTabProps) {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <iconify-icon
          icon="solar:info-circle-linear"
          stroke-width="1.5"
          className="mt-0.5 text-lg text-zinc-400"
        />
        <div>
          <h4 className="font-medium text-sm text-zinc-900">Revisão de cadastro</h4>
          <p className="mt-1 text-sm text-zinc-500">
            Os dados do CNES são importados e comparados com as informações do seu CRM. Aprove ou
            rejeite as alterações sugeridas abaixo. Suas edições manuais estão sempre protegidas e
            nunca são sobrescritas silenciosamente.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-zinc-500">Carregando sugestões…</div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <iconify-icon
            icon="solar:check-circle-linear"
            stroke-width="1.5"
            className="text-3xl text-emerald-500"
          />
          <h4 className="mt-3 font-medium text-sm text-zinc-900">Nenhuma sugestão pendente</h4>
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
  )
}

function SuggestionCard({
  suggestion,
  onApprove,
  onReject
}: {
  suggestion: RegistrySuggestion
  onApprove: () => void
  onReject: () => void
}) {
  const typeLabels: Record<RegistrySuggestion['type'], string> = {
    FACILITY_REGISTRY_DEACTIVATED: 'Desativação de unidade',
    FACILITY_REGISTRY_REACTIVATED: 'Reativação de unidade',
    DOCTOR_FACILITY_REGISTRY_DEACTIVATED: 'Remoção de profissional'
  }
  const dotColor: Record<RegistrySuggestion['type'], string> = {
    FACILITY_REGISTRY_DEACTIVATED: 'bg-amber-500',
    FACILITY_REGISTRY_REACTIVATED: 'bg-emerald-500',
    DOCTOR_FACILITY_REGISTRY_DEACTIVATED: 'bg-blue-500'
  }

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-zinc-200 border-b bg-zinc-50/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', dotColor[suggestion.type])} />
          <h3 className="font-medium text-sm text-zinc-900">{typeLabels[suggestion.type]}</h3>
          <span className="ml-2 text-xs text-zinc-400">
            Execução #{suggestion.ingestionRunId.slice(0, 8)} •{' '}
            {new Date(suggestion.suggestedAt).toLocaleString('pt-BR')}
          </span>
        </div>
        <Badge variant="secondary">Pendente</Badge>
      </div>

      <div className="p-5">
        <p className="text-sm text-zinc-700">
          {suggestion.reason || 'Divergência de cadastro detectada.'}
        </p>
        {suggestion.payload && Object.keys(suggestion.payload).length > 0 && (
          <pre className="mt-3 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
            {JSON.stringify(suggestion.payload, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-zinc-200 border-t bg-white px-5 py-4">
        <Button variant="ghost" onClick={onReject}>
          Descartar
        </Button>
        <Button onClick={onApprove}>Aplicar sugestão</Button>
      </div>
    </div>
  )
}

function TerritoryTab({ facility }: { facility: Facility }) {
  const { getLabel } = useTerritoryLabels()
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
          <h3 className="font-medium text-sm text-zinc-900 tracking-tight">
            Atribuição geográfica
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-6 p-5">
          <Field
            label="Território"
            value={facility.territoryId ? getLabel(facility.territoryId) : undefined}
          />
          <Field label="Status de atribuição" value={facility.territoryAssignmentStatus} />
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
  )
}
