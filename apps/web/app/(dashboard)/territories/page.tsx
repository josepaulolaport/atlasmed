'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { CreateTerritoryDialog } from '@/components/territory/create-territory-dialog'
import { ReparentTerritoryDialog } from '@/components/territory/reparent-territory-dialog'
import { TerritoryDetailPanel } from '@/components/territory/territory-detail-panel'
import { TerritorySubnav } from '@/components/territory/territory-subnav'
import { TerritoryTree } from '@/components/territory/territory-tree'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { territoriesApi } from '@/lib/api/territories'
import {
  canCreateTerritories,
  canManageTerritories,
  canManageUsers,
  canReadTerritories,
  canUpdateTerritories,
  isAdmin
} from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { Territory, TerritoryTreeNode } from '@/types/territory'

type TerritoryView = 'grouping' | 'manager-zones' | 'rep-patches'

const VIEW_OPTIONS: Array<{ id: TerritoryView; label: string; description: string }> = [
  {
    id: 'grouping',
    label: 'Agrupamento',
    description: 'Árvore de região, estado e município para filtros e análises.'
  },
  {
    id: 'manager-zones',
    label: 'Zonas de gerente',
    description: 'Áreas planas de atribuição de gerente que contêm áreas de representante.'
  },
  {
    id: 'rep-patches',
    label: 'Áreas de representante',
    description: 'Territórios operacionais onde as clínicas são atribuídas.'
  }
]

function findTerritoryInTree(nodes: TerritoryTreeNode[], id: string): Territory | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findTerritoryInTree(node.children, id)
    if (found) return found
  }
  return null
}

function toFlatTreeNodes(territories: Territory[]): TerritoryTreeNode[] {
  return territories.map((territory) => ({
    ...territory,
    children: []
  }))
}

export default function TerritoriesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedSelection = searchParams.get('selected') ?? undefined
  const requestedView = searchParams.get('view') as TerritoryView | null
  const [view, setView] = useState<TerritoryView>(
    requestedView && VIEW_OPTIONS.some((option) => option.id === requestedView)
      ? requestedView
      : 'grouping'
  )
  const [tree, setTree] = useState<TerritoryTreeNode[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [reparentOpen, setReparentOpen] = useState(false)
  const [recomputing, setRecomputing] = useState(false)

  const canRead = user ? canReadTerritories(user.role.name) : false
  const canCreate = user ? canCreateTerritories(user.role.name) : false
  const canUpdate = user ? canUpdateTerritories(user.role.name) : false
  const canManage = user ? canManageTerritories(user.role.name) : false
  const canAssignUsers = user ? canManageUsers(user.role.name) : false
  const userIsAdmin = user ? isAdmin(user.role.name) : false

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      let nodes: TerritoryTreeNode[] = []

      if (view === 'grouping') {
        const response = await territoriesApi.listGroupingTree()
        nodes = response.data
      } else {
        const response = await territoriesApi.listTerritories('flat')
        const territories = response.data as Territory[]
        const filtered =
          view === 'manager-zones'
            ? territories.filter((territory) => territory.territoryType.assignableToManagers)
            : territories.filter((territory) => territory.territoryType.assignsClinics)
        nodes = toFlatTreeNodes(filtered)
      }

      setTree(nodes)
      setSelectedId((current) => {
        if (current && nodes.some((node) => node.id === current)) {
          return current
        }
        return requestedSelection ?? nodes[0]?.id
      })
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar territórios',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [requestedSelection, view])

  useEffect(() => {
    if (requestedSelection) {
      setSelectedId(requestedSelection)
    }
  }, [requestedSelection])

  useEffect(() => {
    if (user && !canRead) {
      router.replace('/unauthorized')
    }
  }, [user, canRead, router])

  useEffect(() => {
    if (canRead) {
      void loadTree()
    }
  }, [canRead, loadTree])

  const selectedTerritory = selectedId ? findTerritoryInTree(tree, selectedId) : null
  const activeView = VIEW_OPTIONS.find((option) => option.id === view)!

  const handleRecompute = async () => {
    if (!confirm('Recalcular a associação de território das clínicas para todas as clínicas?'))
      return

    setRecomputing(true)
    try {
      const result = await territoriesApi.recomputeMembership()
      toast({
        title: 'Membership recomputed',
        description: `Processed ${result.processed}, updated ${result.updated}`,
        variant: 'success'
      })
      await loadTree()
    } catch (err) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(err, 'Falha ao reprocessar atribuições'),
        variant: 'destructive'
      })
    } finally {
      setRecomputing(false)
    }
  }

  if (!user || !canRead) {
    return null
  }

  return (
    <>
      <div className="border-zinc-100 border-b px-6 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="font-medium text-2xl text-zinc-900 tracking-tight">Territórios</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Zonas de gerente e áreas de representante definem o escopo de atribuição. As áreas de
              agrupamento são usadas apenas para filtros e análises.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => loadTree()}>
              <iconify-icon icon="solar:refresh-linear" stroke-width="1.5" className="text-base" />
              Atualizar
            </Button>
            {canManage && (
              <Button variant="outline" size="sm" onClick={handleRecompute} disabled={recomputing}>
                {recomputing ? 'Recalculando...' : 'Recalcular associação'}
              </Button>
            )}
            {canCreate && (
              <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                <iconify-icon
                  icon="solar:add-circle-linear"
                  stroke-width="1.5"
                  className="text-base"
                />
                Criar território
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl p-6">
        <TerritorySubnav />

        <div className="mt-4 mb-4 flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              className={cn(
                'rounded-md border px-3 py-2 text-left text-sm transition-colors',
                view === option.id
                  ? 'border-blue-200 bg-blue-50 text-blue-800'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              )}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-zinc-500">{option.description}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
              <h3 className="font-medium text-sm text-zinc-900 tracking-tight">
                {activeView.label}
              </h3>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
              ) : tree.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">
                  Nenhum registro encontrado para {activeView.label.toLowerCase()}.
                </p>
              ) : (
                <TerritoryTree nodes={tree} selectedId={selectedId} onSelect={setSelectedId} />
              )}
            </div>
          </div>

          <TerritoryDetailPanel
            territory={selectedTerritory}
            canManage={canAssignUsers}
            canUpdate={canUpdate}
            isAdmin={userIsAdmin}
            onRefresh={loadTree}
            onReparent={() => setReparentOpen(true)}
          />
        </div>
      </div>

      <CreateTerritoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        parentId={view === 'grouping' ? selectedId : undefined}
        isAdmin={userIsAdmin}
        onSuccess={loadTree}
      />

      <ReparentTerritoryDialog
        territory={selectedTerritory}
        open={reparentOpen}
        onOpenChange={setReparentOpen}
        isAdmin={userIsAdmin}
        onSuccess={loadTree}
      />
    </>
  )
}
