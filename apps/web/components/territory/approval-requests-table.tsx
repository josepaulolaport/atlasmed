'use client'

import { useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { territoriesApi } from '@/lib/api/territories'
import { formatDateTime } from '@/lib/utils'
import type { TerritoryApprovalRequest } from '@/types/territory'

interface ApprovalRequestsTableProps {
  requests: TerritoryApprovalRequest[]
  onRefresh: () => void
}

export function ApprovalRequestsTable({ requests, onRefresh }: ApprovalRequestsTableProps) {
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const openAction = (id: string, type: 'approve' | 'reject') => {
    setActionId(id)
    setActionType(type)
    setNote('')
  }

  const closeAction = () => {
    setActionId(null)
    setActionType(null)
    setNote('')
  }

  const handleConfirm = async () => {
    if (!actionId || !actionType) return

    setSaving(true)
    try {
      if (actionType === 'approve') {
        await territoriesApi.approveRequest(actionId, note.trim() || undefined)
        toast({ title: 'Approved', description: 'Request approved', variant: 'success' })
      } else {
        await territoriesApi.rejectRequest(actionId, note.trim() || undefined)
        toast({ title: 'Rejected', description: 'Request rejected', variant: 'success' })
      }
      closeAction()
      onRefresh()
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to process request'),
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (requests.length === 0) {
    return <p className="text-gray-500 text-sm">Nenhuma solicitação de aprovação encontrada.</p>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Alvo</TableHead>
            <TableHead>Criado</TableHead>
            <TableHead className="w-[160px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((req) => (
            <TableRow key={req.id}>
              <TableCell className="font-medium">{req.type}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    req.status === 'pending'
                      ? 'secondary'
                      : req.status === 'approved'
                        ? 'success'
                        : req.status === 'rejected'
                          ? 'destructive'
                          : 'outline'
                  }
                >
                  {req.status}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{req.requesterId}</TableCell>
              <TableCell className="font-mono text-xs">
                {req.targetTerritoryId ?? req.facilityId ?? '—'}
              </TableCell>
              <TableCell className="text-sm">{formatDateTime(req.createdAt)}</TableCell>
              <TableCell>
                {req.status === 'pending' ? (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => openAction(req.id, 'approve')}>
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAction(req.id, 'reject')}
                    >
                      Rejeitar
                    </Button>
                  </div>
                ) : (
                  <span className="text-gray-500 text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={actionId !== null} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Aprovar solicitação' : 'Rejeitar solicitação'}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="approval-note">Nota (opcional)</Label>
            <Input id="approval-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
