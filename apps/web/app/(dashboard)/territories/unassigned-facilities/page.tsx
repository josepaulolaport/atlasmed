'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useReducer, useState } from 'react'
import { TerritoryPicker } from '@/components/territory/territory-picker'
import { TerritorySubnav } from '@/components/territory/territory-subnav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { territoriesApi } from '@/lib/api/territories'
import { canReadTerritories, isAdmin } from '@/lib/permissions'
import type { UnassignedFacility } from '@/types/territory'

type FacilitiesState = {
  facilities: UnassignedFacility[]
  loading: boolean
  page: number
  totalPages: number
}

type FacilitiesAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; facilities: UnassignedFacility[]; totalPages: number }
  | { type: 'FETCH_ERROR' }
  | { type: 'SET_PAGE'; page: number }

function facilitiesReducer(state: FacilitiesState, action: FacilitiesAction): FacilitiesState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true }
    case 'FETCH_SUCCESS':
      return {
        ...state,
        facilities: action.facilities,
        totalPages: action.totalPages,
        loading: false
      }
    case 'FETCH_ERROR':
      return { ...state, loading: false }
    case 'SET_PAGE':
      return { ...state, page: action.page }
    default:
      return state
  }
}

const initialFacilitiesState: FacilitiesState = {
  facilities: [],
  loading: true,
  page: 1,
  totalPages: 1
}

export default function UnassignedFacilitiesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [state, dispatch] = useReducer(facilitiesReducer, initialFacilitiesState)
  const [overrideFacility, setOverrideFacility] = useState<UnassignedFacility | null>(null)
  const [overrideTerritoryId, setOverrideTerritoryId] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [unlockingId, setUnlockingId] = useState<string | null>(null)

  const canRead = user ? canReadTerritories(user.role.name) : false
  const userIsAdmin = user ? isAdmin(user.role.name) : false

  useEffect(() => {
    if (user && !canRead) {
      router.replace('/unauthorized')
      return
    }

    if (!canRead) return

    const fetchFacilities = async () => {
      dispatch({ type: 'FETCH_START' })
      try {
        const response = await territoriesApi.listUnassignedFacilities({
          page: state.page,
          limit: 20
        })
        dispatch({
          type: 'FETCH_SUCCESS',
          facilities: response.data,
          totalPages: response.pagination.totalPages
        })
      } catch {
        toast({
          title: 'Erro',
          description: 'Falha ao carregar unidades sem território',
          variant: 'destructive'
        })
        dispatch({ type: 'FETCH_ERROR' })
      }
    }

    fetchFacilities()
  }, [user, canRead, state.page, router])

  const handleOverride = async () => {
    if (!overrideFacility || !overrideTerritoryId) return

    setSaving(true)
    try {
      await territoriesApi.overrideClinicTerritory(overrideFacility.id, {
        territoryId: overrideTerritoryId,
        reason: overrideReason.trim() || undefined
      })
      toast({
        title: 'Sucesso',
        description: 'Território da unidade sobrescrito',
        variant: 'success'
      })
      setOverrideFacility(null)
      setOverrideTerritoryId('')
      setOverrideReason('')
      dispatch({ type: 'FETCH_START' })
      try {
        const refreshResponse = await territoriesApi.listUnassignedFacilities({
          page: state.page,
          limit: 20
        })
        dispatch({
          type: 'FETCH_SUCCESS',
          facilities: refreshResponse.data,
          totalPages: refreshResponse.pagination.totalPages
        })
      } catch {
        dispatch({ type: 'FETCH_ERROR' })
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(err, 'Falha ao sobrescrever território'),
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUnlock = async (facilityId: string) => {
    setUnlockingId(facilityId)
    try {
      await territoriesApi.unlockClinicGeo(facilityId)
      toast({
        title: 'Sucesso',
        description: 'Bloqueio geográfico da unidade removido',
        variant: 'success'
      })
      dispatch({ type: 'FETCH_START' })
      try {
        const refreshResponse = await territoriesApi.listUnassignedFacilities({
          page: state.page,
          limit: 20
        })
        dispatch({
          type: 'FETCH_SUCCESS',
          facilities: refreshResponse.data,
          totalPages: refreshResponse.pagination.totalPages
        })
      } catch {
        dispatch({ type: 'FETCH_ERROR' })
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(err, 'Falha ao remover bloqueio geográfico'),
        variant: 'destructive'
      })
    } finally {
      setUnlockingId(null)
    }
  }

  if (!user || !canRead) {
    return null
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-bold text-3xl text-gray-900">Clínicas não atribuídas</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Clínicas sem atribuição de território resolvida
        </p>
      </div>

      <TerritorySubnav />

      <Card>
        <CardHeader>
          <CardTitle>Clínicas que precisam de território</CardTitle>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clínica</TableHead>
                    <TableHead>Coordenadas</TableHead>
                    <TableHead>Status</TableHead>
                    {userIsAdmin && <TableHead className="w-[200px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.facilities.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={userIsAdmin ? 4 : 3}
                        className="text-center text-gray-500"
                      >
                        Nenhuma clínica não atribuída encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    state.facilities.map((facility) => (
                      <TableRow key={facility.id}>
                        <TableCell>
                          <Link
                            href={`/facilities/${facility.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {facility.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {facility.lat != null && facility.lng != null
                            ? `${facility.lat.toFixed(4)}, ${facility.lng.toFixed(4)}`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              facility.territoryAssignmentStatus === 'ambiguous'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {facility.territoryAssignmentStatus}
                          </Badge>
                        </TableCell>
                        {userIsAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setOverrideFacility(facility)
                                  setOverrideTerritoryId('')
                                  setOverrideReason('')
                                }}
                              >
                                Substituir
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnlock(facility.id)}
                                disabled={unlockingId === facility.id}
                              >
                                {unlockingId === facility.id ? '...' : 'Desbloquear geo'}
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
                  disabled={state.page <= 1}
                  onClick={() => dispatch({ type: 'SET_PAGE', page: state.page - 1 })}
                >
                  Anterior
                </Button>
                <span className="text-gray-500 text-sm">
                  Página {state.page} de {state.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={state.page >= state.totalPages}
                  onClick={() => dispatch({ type: 'SET_PAGE', page: state.page + 1 })}
                >
                  Próxima
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={overrideFacility !== null}
        onOpenChange={(open) => !open && setOverrideFacility(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substituir território da clínica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">Unidade: {overrideFacility?.id}</p>
            <div>
              <Label>Território</Label>
              <TerritoryPicker
                value={overrideTerritoryId}
                onChange={setOverrideTerritoryId}
                filterAssignableToUsers
              />
            </div>
            <div>
              <Label htmlFor="override-reason">Motivo (opcional)</Label>
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideFacility(null)}>
              Cancelar
            </Button>
            <Button onClick={handleOverride} disabled={saving || !overrideTerritoryId}>
              {saving ? 'Salvando...' : 'Substituir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
