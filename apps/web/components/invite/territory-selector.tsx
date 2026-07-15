'use client'

import { AlertCircle, List, Loader2, Map as MapIcon, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { territoriesApi } from '@/lib/api/territories'
import type { Territory } from '@/types/territory'
import { CreateTerritoryDialog } from './create-territory-dialog'

interface TerritorySelectorProps {
  value?: string
  onChange: (territoryId: string | undefined) => void
  territoryType: 'manager_zone' | 'patch'
  managerTerritoryId?: string
  disabled?: boolean
  error?: string
  required?: boolean
}

export function TerritorySelector({
  value,
  onChange,
  territoryType,
  managerTerritoryId,
  disabled = false,
  error,
  required = false
}: TerritorySelectorProps) {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const isRepPatch = territoryType === 'patch'
  const label = isRepPatch ? 'Território do Representante (Patch)' : 'Território do Gerente (Zona)'

  const helperText = isRepPatch
    ? 'Selecione um território patch dentro da zona do gerente'
    : 'Selecione uma zona de gerente para atribuir'

  useEffect(() => {
    const fetchTerritories = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        let data: Territory[]
        if (isRepPatch) {
          const response = await territoriesApi.listRepPatches(managerTerritoryId)
          data = response.data
        } else {
          const response = await territoriesApi.listManagerZones()
          data = response.data
        }
        setTerritories(data)
      } catch (err) {
        setLoadError('Falha ao carregar territórios')
        console.error('Failed to fetch territories:', err)
      } finally {
        setLoading(false)
      }
    }

    // Only fetch if not disabled, or if patch and has manager territory
    if (!disabled && (!isRepPatch || managerTerritoryId)) {
      fetchTerritories()
    } else if (isRepPatch && !managerTerritoryId) {
      setTerritories([])
      setLoading(false)
    }
  }, [managerTerritoryId, disabled, isRepPatch])

  const filteredTerritories = territories.filter(
    (territory) =>
      territory.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      territory.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedTerritory = territories.find((t) => t.id === value)

  const handleTerritoryCreated = (territory: Territory) => {
    setTerritories((prev) => [territory, ...prev])
    onChange(territory.id)
  }

  const handleSelect = (territoryId: string) => {
    if (value === territoryId) {
      onChange(undefined) // Deselect if clicking again
    } else {
      onChange(territoryId)
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-600">*</span>}
      </Label>

      {isRepPatch && !managerTerritoryId && (
        <div className="rounded-md bg-amber-50 p-3 text-amber-700 text-sm">
          <p>Selecione um gerente primeiro para ver os territórios disponíveis</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando territórios...</span>
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <p>{loadError}</p>
        </div>
      ) : (
        <>
          <Tabs defaultValue="list" className="w-full">
            <div className="mb-2 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="map" className="flex items-center gap-2">
                  <MapIcon className="h-4 w-4" />
                  Mapa
                </TabsTrigger>
              </TabsList>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                disabled={disabled}
              >
                <Plus className="mr-1 h-4 w-4" />
                Criar Novo
              </Button>
            </div>

            <TabsContent value="list" className="space-y-3">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar território..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={disabled}
                />
              </div>

              {filteredTerritories.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    {searchQuery
                      ? 'Nenhum território encontrado'
                      : territories.length === 0
                        ? 'Nenhum território disponível. Crie um novo território para continuar.'
                        : 'Nenhum território corresponde à sua busca'}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTerritories.map((territory) => {
                        const isSelected = value === territory.id
                        return (
                          <TableRow key={territory.id} className={isSelected ? 'bg-blue-50' : ''}>
                            <TableCell className="font-medium">{territory.name}</TableCell>
                            <TableCell>
                              <code className="text-xs">{territory.code}</code>
                            </TableCell>
                            <TableCell>
                              <Badge variant={territory.isActive ? 'default' : 'secondary'}>
                                {territory.isActive ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant={isSelected ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleSelect(territory.id)}
                                disabled={disabled}
                              >
                                {isSelected ? 'Selecionado' : 'Selecionar'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="map" className="space-y-3">
              <div className="rounded-md border border-dashed p-12 text-center">
                <MapIcon className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-gray-500 text-sm">Visualização de mapa</p>
                <p className="text-gray-400 text-xs">
                  A visualização de mapa com limites de território será implementada aqui. Use a
                  visualização de lista para selecionar territórios por enquanto.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {selectedTerritory && (
            <div className="rounded-md bg-blue-50 p-3 text-sm">
              <p className="font-medium text-blue-900">Território Selecionado:</p>
              <p className="text-blue-700">
                {selectedTerritory.name} ({selectedTerritory.code})
              </p>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <p className="text-gray-500 text-xs">{helperText}</p>
        </>
      )}

      <CreateTerritoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        territoryType={territoryType}
        onTerritoryCreated={handleTerritoryCreated}
      />
    </div>
  )
}
