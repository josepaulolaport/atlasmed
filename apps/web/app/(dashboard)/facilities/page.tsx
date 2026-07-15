'use client'

import { MapPin, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTerritoryLabels } from '@/components/territory/territory-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { facilitiesApi } from '@/lib/api/facilities'
import { mapsApi } from '@/lib/api/maps'
import { canManageFacilities, canReadFacilities } from '@/lib/permissions'
import type { Facility } from '@/types/facility'

function territoryStatusBadge(status?: Facility['territoryAssignmentStatus']) {
  if (!status || status === 'assigned') return null
  return (
    <Badge variant={status === 'ambiguous' ? 'secondary' : 'outline'} className="ml-2 text-xs">
      {status}
    </Badge>
  )
}

function purchaseStatusBadge(status?: Facility['purchaseStatus']) {
  if (!status) return null

  const variants: Record<
    string,
    { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }
  > = {
    NAO_COMPRA: { variant: 'outline', label: 'Não compra' },
    COMPRA: { variant: 'default', label: 'Compra' },
    COMPRA_POUCO: { variant: 'secondary', label: 'Compra pouco' },
    COMPRA_MUITO: { variant: 'default', label: 'Compra muito' }
  }

  const config = variants[status]
  return config ? (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  ) : null
}

export default function FacilitiesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null)
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formStateCode, setFormStateCode] = useState('')
  const [formCnpj, setFormCnpj] = useState('')
  const [formLat, setFormLat] = useState('')
  const [formLng, setFormLng] = useState('')
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const canRead = user ? canReadFacilities(user.role.name) : false
  const canManage = user ? canManageFacilities(user.role.name) : false
  const { getLabel } = useTerritoryLabels()

  useEffect(() => {
    if (user && !canRead) {
      router.replace('/unauthorized')
    }
  }, [user, canRead, router])

  useEffect(() => {
    if (!canRead) return

    const loadFacilities = async () => {
      setLoading(true)
      try {
        const response = await facilitiesApi.getFacilities({
          page,
          limit: 12,
          search: search || undefined
        })
        setFacilities(response.data)
        setTotalPages(response.pagination.totalPages)
      } catch (error) {
        toast({
          title: 'Erro',
          description: getApiErrorMessage(error, 'Falha ao carregar unidades'),
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    void loadFacilities()
  }, [page, search, refreshKey, canRead])

  const openCreateDialog = () => {
    setEditingFacility(null)
    setFormName('')
    setFormAddress('')
    setFormCity('')
    setFormStateCode('')
    setFormCnpj('')
    setFormLat('')
    setFormLng('')
    setDialogOpen(true)
  }

  const openEditDialog = (facility: Facility) => {
    setEditingFacility(facility)
    setFormName(facility.name)
    setFormAddress(facility.address ?? '')
    setFormCity(facility.city ?? '')
    setFormStateCode(facility.stateCode ?? '')
    setFormCnpj(facility.cnpj ?? '')
    setFormLat(facility.lat != null ? String(facility.lat) : '')
    setFormLng(facility.lng != null ? String(facility.lng) : '')
    setDialogOpen(true)
  }

  const parseCoordinate = (value: string): number | null | undefined => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const handleGeocodeAddress = async () => {
    if (!formAddress.trim()) {
      toast({
        title: 'Validation',
        description: 'Enter an address to geocode',
        variant: 'destructive'
      })
      return
    }

    setGeocoding(true)
    try {
      const result = await mapsApi.forwardGeocode(formAddress.trim())
      if (!result) {
        toast({
          title: 'Not found',
          description: 'Could not resolve coordinates for this address',
          variant: 'destructive'
        })
        return
      }

      setFormLat(String(result.latitude))
      setFormLng(String(result.longitude))
      toast({
        title: 'Geocodificado',
        description: result.fullAddress ?? 'Coordenadas atualizadas a partir do endereço',
        variant: 'success'
      })
    } catch {
      toast({
        title: 'Erro',
        description: 'Geocodificação falhou. Verifique se o Mapbox está configurado na API.',
        variant: 'destructive'
      })
    } finally {
      setGeocoding(false)
    }
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({
        title: 'Validação',
        description: 'O nome é obrigatório',
        variant: 'destructive'
      })
      return
    }

    const lat = parseCoordinate(formLat)
    const lng = parseCoordinate(formLng)
    if (lat === undefined || lng === undefined) {
      toast({
        title: 'Validação',
        description: 'Latitude e longitude devem ser números válidos quando informados',
        variant: 'destructive'
      })
      return
    }

    if (lat == null && lng == null && !formAddress.trim()) {
      toast({
        title: 'Validação',
        description: 'Informe um endereço ou coordenadas',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      if (editingFacility) {
        await facilitiesApi.updateFacility(editingFacility.id, {
          name: formName.trim(),
          address: formAddress.trim() || null,
          city: formCity.trim() || null,
          stateCode: formStateCode.trim() || null,
          cnpj: formCnpj.trim() || null,
          lat,
          lng
        })
        toast({
          title: 'Sucesso',
          description:
            'Unidade atualizada. O território será atribuído automaticamente pelas coordenadas.',
          variant: 'success'
        })
      } else {
        await facilitiesApi.createFacility({
          name: formName.trim(),
          address: formAddress.trim() || undefined,
          city: formCity.trim() || undefined,
          stateCode: formStateCode.trim() || undefined,
          cnpj: formCnpj.trim() || undefined,
          lat: lat ?? undefined,
          lng: lng ?? undefined
        })
        toast({
          title: 'Sucesso',
          description:
            'Unidade criada. O território será atribuído automaticamente quando as coordenadas corresponderem a uma região.',
          variant: 'success'
        })
      }

      setDialogOpen(false)
      setRefreshKey((value) => value + 1)
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao salvar unidade'),
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (facility: Facility) => {
    if (!confirm(`Excluir a unidade "${facility.name}"?`)) return

    try {
      await facilitiesApi.deleteFacility(facility.id)
      toast({ title: 'Sucesso', description: 'Unidade excluída', variant: 'success' })
      setRefreshKey((value) => value + 1)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao excluir unidade',
        variant: 'destructive'
      })
    }
  }

  if (!canRead) {
    return null
  }

  return (
    <>
      <div className="border-zinc-100 border-b px-6 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="font-medium text-2xl text-zinc-900 tracking-tight">Unidades de saúde</h1>
            <p className="mt-1 text-sm text-zinc-500">
              As unidades são atribuídas a territórios automaticamente a partir das coordenadas.
            </p>
          </div>
          {canManage && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Adicionar unidade
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl p-6">
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Buscar unidades..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="pl-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">Carregando unidades…</div>
        ) : facilities.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500">Nenhuma unidade encontrada</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {facilities.map((facility) => (
                <div
                  key={facility.id}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Users className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                          <span className="text-xs text-zinc-500">
                            Consultor:{' '}
                            <span className="font-medium text-zinc-900">
                              {facility.consultantName ?? '—'}
                            </span>
                          </span>
                        </div>
                        <Link
                          href={`/facilities/${facility.id}`}
                          className="block truncate font-semibold text-lg text-zinc-900 transition-colors hover:text-blue-600"
                        >
                          {facility.name}
                        </Link>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1 pl-2">
                        <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1">
                          <Users className="h-3.5 w-3.5 text-zinc-500" />
                          <span className="font-medium text-sm text-zinc-700">
                            {facility.professionalCount ?? 0}
                          </span>
                        </div>
                        {canManage && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(facility)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(facility)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-5">
                    {facility.cnpj && (
                      <div>
                        <p className="mb-0.5 text-xs text-zinc-500">CNPJ</p>
                        <p className="text-sm text-zinc-900">{facility.cnpj}</p>
                      </div>
                    )}

                    {facility.address && (
                      <div>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                          <p className="text-sm text-zinc-700">{facility.address}</p>
                        </div>
                      </div>
                    )}

                    {(facility.city || facility.stateCode) && (
                      <div>
                        <p className="font-medium text-sm text-zinc-900">
                          {facility.city}
                          {facility.city && facility.stateCode && ', '}
                          {facility.stateCode}
                        </p>
                      </div>
                    )}

                    {facility.lat != null && facility.lng != null && (
                      <div>
                        <p className="mb-0.5 text-xs text-zinc-500">Coordenadas</p>
                        <p className="font-mono text-xs text-zinc-600">
                          {facility.lat.toFixed(4)}, {facility.lng.toFixed(4)}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      {facility.territoryId ? (
                        <>
                          <p className="text-xs text-zinc-500">Território:</p>
                          <span className="font-medium text-xs text-zinc-900">
                            {getLabel(facility.territoryId)}
                          </span>
                          {territoryStatusBadge(facility.territoryAssignmentStatus)}
                        </>
                      ) : (
                        <p className="text-xs text-zinc-500">Sem território atribuído</p>
                      )}
                    </div>

                    {facility.purchaseStatus && (
                      <div className="pt-2">{purchaseStatusBadge(facility.purchaseStatus)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-zinc-500">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Próximo
              </Button>
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFacility ? 'Editar unidade' : 'Criar unidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clinic-name">Nome</Label>
              <Input
                id="clinic-name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="clinic-cnpj">CNPJ</Label>
                <Input
                  id="clinic-cnpj"
                  value={formCnpj}
                  onChange={(event) => setFormCnpj(event.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="clinic-address">Endereço</Label>
              <div className="flex gap-2">
                <Input
                  id="clinic-address"
                  value={formAddress}
                  onChange={(event) => setFormAddress(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding}
                >
                  {geocoding ? 'Geocodificando...' : 'Geocodificar'}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="clinic-city">Cidade</Label>
                <Input
                  id="clinic-city"
                  value={formCity}
                  onChange={(event) => setFormCity(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="clinic-state">Estado (UF)</Label>
                <Input
                  id="clinic-state"
                  value={formStateCode}
                  onChange={(event) => setFormStateCode(event.target.value)}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="clinic-lat">Latitude</Label>
                <Input
                  id="clinic-lat"
                  type="number"
                  step="any"
                  placeholder="-23.5505"
                  value={formLat}
                  onChange={(event) => setFormLat(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="clinic-lng">Longitude</Label>
                <Input
                  id="clinic-lng"
                  type="number"
                  step="any"
                  placeholder="-46.6333"
                  value={formLng}
                  onChange={(event) => setFormLng(event.target.value)}
                />
              </div>
            </div>
            {editingFacility?.territoryId && (
              <p className="text-gray-600 text-sm">
                Território atual: {getLabel(editingFacility.territoryId)} (atribuído
                automaticamente)
              </p>
            )}
            <p className="text-gray-500 text-xs">
              As coordenadas são salvas no cadastro da unidade quando geocodificadas (na prévia ou
              ao salvar). A atribuição de território é executada automaticamente a partir das
              coordenadas armazenadas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
