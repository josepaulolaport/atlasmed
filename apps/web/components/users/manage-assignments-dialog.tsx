'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { TerritoryPicker, useTerritoryLabels } from '@/components/territory/territory-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { usersApi } from '@/lib/api/users'
import type { User, UserAssignments } from '@/types/auth'

interface Sector {
  id: string
  slug: string
  name: string
}

import { getTerritoryAssignmentPickerConfig } from '@/lib/territory/assignment-picker-config'

interface ManageAssignmentsDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageAssignmentsDialog({
  user,
  open,
  onOpenChange
}: ManageAssignmentsDialogProps) {
  const [assignments, setAssignments] = useState<UserAssignments | null>(null)
  const [managers, setManagers] = useState<User[]>([])
  const [allSectors, setAllSectors] = useState<Sector[]>([])
  const [loading, setLoading] = useState(false)
  const [savingManager, setSavingManager] = useState(false)
  const [selectedTerritoryId, setSelectedTerritoryId] = useState('')
  const [selectedSectorId, setSelectedSectorId] = useState('')
  const [territoryBusy, setTerritoryBusy] = useState<string | null>(null)
  const [sectorBusy, setSectorBusy] = useState<string | null>(null)
  const { getLabel } = useTerritoryLabels()

  const isTargetUser = user?.role.name === 'REP'
  const isTargetManager = user?.role.name === 'MANAGER'
  const canAssignTerritories = isTargetUser || isTargetManager
  const territoryPickerConfig = user
    ? getTerritoryAssignmentPickerConfig(isTargetManager ? 'MANAGER' : 'REP')
    : null

  const loadData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const [assignmentsData, usersResponse, sectorsData] = await Promise.all([
        usersApi.getUserAssignments(user.id),
        usersApi.getUsers({ page: 1, limit: 100 }),
        usersApi.getSectors()
      ])

      setAssignments(assignmentsData)
      setAllSectors(sectorsData)
      setManagers(
        usersResponse.data.filter(
          (u) => (u.role.name === 'MANAGER' || u.role.name === 'ADMIN') && u.id !== user.id
        )
      )
    } catch {
      toast({
        title: 'Error',
        description: 'Falha ao carregar atribuições',
        variant: 'destructive'
      })
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }, [user, onOpenChange])

  useEffect(() => {
    if (open && user) {
      setSelectedTerritoryId('')
      setSelectedSectorId('')
      loadData()
    } else {
      setAssignments(null)
    }
  }, [open, user, loadData])

  const handleManagerChange = async (value: string) => {
    if (!user) return

    const managerId = value === 'none' ? null : value
    setSavingManager(true)
    try {
      await usersApi.assignManager(user.id, managerId)
      await loadData()
      toast({
        title: 'Success',
        description: managerId ? 'Manager assigned successfully' : 'Manager removed successfully',
        variant: 'success'
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to update manager'),
        variant: 'destructive'
      })
    } finally {
      setSavingManager(false)
    }
  }

  const handleAddTerritory = async () => {
    if (!user || !selectedTerritoryId) return

    setTerritoryBusy('add')
    try {
      await usersApi.assignTerritory(user.id, selectedTerritoryId)
      setSelectedTerritoryId('')
      await loadData()
      toast({
        title: 'Success',
        description: 'Territory assigned successfully',
        variant: 'success'
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to assign territory'),
        variant: 'destructive'
      })
    } finally {
      setTerritoryBusy(null)
    }
  }

  const handleRevokeTerritory = async (territoryId: string) => {
    if (!user) return

    setTerritoryBusy(territoryId)
    try {
      await usersApi.revokeTerritory(user.id, territoryId)
      await loadData()
      toast({
        title: 'Success',
        description: 'Territory revoked successfully',
        variant: 'success'
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to revoke territory'),
        variant: 'destructive'
      })
    } finally {
      setTerritoryBusy(null)
    }
  }

  const handleAddSector = async () => {
    if (!user || !selectedSectorId) return

    setSectorBusy('add')
    try {
      await usersApi.assignSector(user.id, selectedSectorId)
      setSelectedSectorId('')
      await loadData()
      toast({ title: 'Setor atribuído com sucesso', variant: 'success' })
    } catch (err) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(err, 'Falha ao atribuir setor'),
        variant: 'destructive'
      })
    } finally {
      setSectorBusy(null)
    }
  }

  const handleRevokeSector = async (sectorId: string) => {
    if (!user) return

    setSectorBusy(sectorId)
    try {
      await usersApi.revokeSector(user.id, sectorId)
      await loadData()
      toast({ title: 'Setor removido com sucesso', variant: 'success' })
    } catch (err) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(err, 'Falha ao remover setor'),
        variant: 'destructive'
      })
    } finally {
      setSectorBusy(null)
    }
  }

  const formatManagerLabel = (m: User) => {
    const name = m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.username
    return `${name} (${m.email})`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar atribuições</DialogTitle>
          <DialogDescription>
            {user ? `Escopo organizacional de ${user.username} (${user.email})` : 'Carregando...'}
          </DialogDescription>
        </DialogHeader>

        {loading || !assignments || !user ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {isTargetUser && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600 text-sm">Status operacional:</span>
                {assignments.isOperationallyActive ? (
                  <Badge variant="success">Ativo</Badge>
                ) : (
                  <Badge variant="secondary">Não atribuído</Badge>
                )}
              </div>
            )}

            {isTargetUser && (
              <div className="space-y-2">
                <Label htmlFor="manager-select">Gerente</Label>
                <Select
                  value={assignments.managerId ?? 'none'}
                  onValueChange={handleManagerChange}
                  disabled={savingManager}
                >
                  <SelectTrigger id="manager-select">
                    <SelectValue placeholder="Selecione o gerente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {formatManagerLabel(manager)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignments.manager && (
                  <p className="text-gray-500 text-xs">
                    Atual: {assignments.manager.username} ({assignments.manager.email})
                  </p>
                )}
              </div>
            )}

            {canAssignTerritories && territoryPickerConfig && (
              <div className="space-y-3">
                <Label>Territórios</Label>
                <p className="text-gray-500 text-xs">{territoryPickerConfig.helperText}</p>
                {assignments.territories.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    Nenhum território atribuído. Selecione um território abaixo.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {assignments.territories.map((t) => (
                      <li
                        key={t.territoryId}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div>
                          <span className="font-medium text-sm">{getLabel(t.territoryId)}</span>
                          <p className="text-gray-500 text-xs">
                            Atribuído {new Date(t.assignedAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeTerritory(t.territoryId)}
                          disabled={territoryBusy !== null}
                          aria-label={`Remover ${t.territoryId}`}
                        >
                          {territoryBusy === t.territoryId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <TerritoryPicker
                  value={selectedTerritoryId}
                  onChange={setSelectedTerritoryId}
                  disabled={territoryBusy !== null}
                  pickerConfig={territoryPickerConfig}
                  excludeCountry={territoryPickerConfig.excludeCountry}
                  placeholder="Selecione um território elegível"
                />
                <Button
                  onClick={handleAddTerritory}
                  disabled={territoryBusy !== null || !selectedTerritoryId}
                  className="w-full"
                >
                  {territoryBusy === 'add' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Adicionar território'
                  )}
                </Button>
              </div>
            )}

            {canAssignTerritories && (
              <div className="space-y-3">
                <Label>Setores</Label>
                <p className="text-gray-500 text-xs">
                  Setores determinam quais territórios este usuário pode visualizar. Sem setores
                  atribuídos, todos os territórios são visíveis.
                </p>
                {assignments.sectors.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    Nenhum setor atribuído. Todos os territórios são visíveis.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {assignments.sectors.map((s) => {
                      const sector = allSectors.find((sec) => sec.id === s.sectorId)
                      return (
                        <li
                          key={s.sectorId}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <div>
                            <span className="font-medium text-sm">
                              {sector?.name ?? s.sectorId}
                            </span>
                            <p className="text-gray-500 text-xs">
                              Atribuído {new Date(s.assignedAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRevokeSector(s.sectorId)}
                            disabled={sectorBusy !== null}
                            aria-label={`Remover setor ${sector?.name ?? s.sectorId}`}
                          >
                            {sectorBusy === s.sectorId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {allSectors.length > 0 && (
                  <>
                    <Select
                      value={selectedSectorId}
                      onValueChange={setSelectedSectorId}
                      disabled={sectorBusy !== null}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {allSectors
                          .filter((sec) => !assignments.sectors.some((s) => s.sectorId === sec.id))
                          .map((sec) => (
                            <SelectItem key={sec.id} value={sec.id}>
                              {sec.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddSector}
                      disabled={sectorBusy !== null || !selectedSectorId}
                      className="w-full"
                    >
                      {sectorBusy === 'add' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Adicionar setor'
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
