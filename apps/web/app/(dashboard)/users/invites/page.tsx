'use client'

import { ArrowLeft, Mail, Phone, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { usersApi } from '@/lib/api/users'
import { canManageUsers } from '@/lib/permissions'
import { formatDateTime } from '@/lib/utils'
import type { Invitation, InviteStatus } from '@/types/auth'

const statusVariant: Record<InviteStatus, 'success' | 'destructive' | 'secondary' | 'default'> = {
  PENDING: 'default',
  ACCEPTED: 'success',
  EXPIRED: 'secondary',
  REVOKED: 'destructive'
}

const statusFilters: Array<{ label: string; value?: InviteStatus }> = [
  { label: 'Todos', value: undefined },
  { label: 'Pendente', value: 'PENDING' },
  { label: 'Aceito', value: 'ACCEPTED' },
  { label: 'Expirado', value: 'EXPIRED' },
  { label: 'Revogado', value: 'REVOKED' }
]

export default function InvitationsPage() {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<InviteStatus | undefined>()
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  useEffect(() => {
    if (currentUser && !canManageUsers(currentUser.role.name)) {
      router.push('/unauthorized')
    }
  }, [currentUser, router])

  useEffect(() => {
    const loadInvitations = async () => {
      setLoading(true)
      try {
        const response = await usersApi.getInvitations({
          page,
          limit: 10,
          status: statusFilter
        })
        setInvitations(response.data)
        setTotalPages(response.pagination.totalPages)
      } catch {
        toast({
          title: 'Erro',
          description: 'Falha ao carregar convites',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    if (currentUser && canManageUsers(currentUser.role.name)) {
      loadInvitations()
    }
  }, [currentUser, page, statusFilter])

  const handleRevoke = async (inviteId: string) => {
    if (!confirm('Tem certeza de que deseja revogar este convite?')) {
      return
    }

    setRevokingId(inviteId)

    try {
      await usersApi.revokeInvite(inviteId)
      toast({
        title: 'Sucesso',
        description: 'Convite revogado com sucesso',
        variant: 'success'
      })

      const response = await usersApi.getInvitations({
        page,
        limit: 10,
        status: statusFilter
      })
      setInvitations(response.data)
      setTotalPages(response.pagination.totalPages)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao revogar convite',
        variant: 'destructive'
      })
    } finally {
      setRevokingId(null)
    }
  }

  const handleResend = async (inviteId: string) => {
    setResendingId(inviteId)

    try {
      await usersApi.resendInvite(inviteId)
      toast({
        title: 'Sucesso',
        description: 'Convite reenviado com sucesso',
        variant: 'success'
      })

      const response = await usersApi.getInvitations({
        page,
        limit: 10,
        status: statusFilter
      })
      setInvitations(response.data)
      setTotalPages(response.pagination.totalPages)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao reenviar convite',
        variant: 'destructive'
      })
    } finally {
      setResendingId(null)
    }
  }

  if (!currentUser || !canManageUsers(currentUser.role.name)) {
    return null
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Usuários
            </Button>
          </Link>
          <h1 className="mt-4 font-bold text-3xl text-gray-900">Convites</h1>
          <p className="mt-2 text-gray-600">
            Visualize e gerencie os convites de usuários pendentes e históricos
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/users">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" />
              Usuários
            </Button>
          </Link>
          <Link href="/users/invite">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar usuário
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.label}
                variant={statusFilter === filter.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter(filter.value)
                  setPage(1)
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Nenhum convite encontrado</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Convidado por</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="space-y-1">
                          {invitation.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3 text-gray-400" />
                              {invitation.email}
                            </div>
                          )}
                          {invitation.phoneNumber && (
                            <div className="flex items-center gap-1 text-gray-600 text-sm">
                              <Phone className="h-3 w-3 text-gray-400" />
                              {invitation.phoneNumber}
                            </div>
                          )}
                          {!invitation.email && !invitation.phoneNumber && (
                            <span className="text-gray-500 text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invitation.role.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[invitation.status]}>
                          {invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invitation.invitedBy ? (
                          <div>
                            <div className="font-medium">
                              {invitation.invitedBy.firstName && invitation.invitedBy.lastName
                                ? `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`
                                : invitation.invitedBy.username}
                            </div>
                            <div className="text-gray-500 text-sm">
                              {invitation.invitedBy.email}
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {formatDateTime(invitation.createdAt)}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {formatDateTime(invitation.expiresAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {invitation.status === 'PENDING' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResend(invitation.id)}
                              disabled={resendingId === invitation.id}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {resendingId === invitation.id ? 'Enviando...' : 'Reenviar'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRevoke(invitation.id)}
                              disabled={revokingId === invitation.id}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {revokingId === invitation.id ? 'Revogando...' : 'Revogar'}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-gray-600 text-sm">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
