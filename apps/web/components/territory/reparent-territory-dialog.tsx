'use client'

import { useState } from 'react'
import { TerritoryPicker } from '@/components/territory/territory-picker'
import { isApprovalRequest } from '@/components/territory/territory-utils'
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
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { territoriesApi } from '@/lib/api/territories'
import type { Territory } from '@/types/territory'

interface ReparentTerritoryDialogProps {
  territory: Territory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isAdmin: boolean
  onSuccess: () => void
}

export function ReparentTerritoryDialog({
  territory,
  open,
  onOpenChange,
  isAdmin,
  onSuccess
}: ReparentTerritoryDialogProps) {
  const [parentId, setParentId] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (next && territory) {
      setParentId(territory.parentId ?? '')
    }
    if (!next) {
      setParentId('')
      setReason('')
    }
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (!territory) return

    setSaving(true)
    try {
      const result = await territoriesApi.updateTerritory(territory.id, {
        parentId: parentId || null,
        reason: reason.trim() || undefined
      })

      if (isApprovalRequest(result)) {
        toast({
          title: 'Submitted for approval',
          description: 'Reparent request is pending admin review.',
          variant: 'success'
        })
      } else {
        toast({
          title: 'Success',
          description: 'Territory reparented successfully',
          variant: 'success'
        })
      }

      handleOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to reparent territory'),
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar pai de {territory?.slug}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-500 text-sm">
            A alteração manual de pai sobrepõe o geovínculo. Deixe vazio para remover o pai (apenas
            nível de país).
          </p>
          <div>
            <Label>Novo pai</Label>
            <TerritoryPicker
              value={parentId}
              onChange={setParentId}
              excludeTerritoryIds={territory ? [territory.id] : []}
              placeholder="Selecionar território pai"
            />
          </div>
          {!isAdmin && (
            <div>
              <Label htmlFor="reparent-reason">Motivo (opcional)</Label>
              <Input
                id="reparent-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : isAdmin ? 'Salvar' : 'Enviar para aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
