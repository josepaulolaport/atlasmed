'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { canManageUsers } from '@/lib/permissions'
import { formatDateTime } from '@/lib/utils'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  const displayName = user.firstName || user.username
  const securityLevel = user.emailVerified && user.phoneVerified ? 'Forte' : 'Médio'

  const stats = [
    {
      label: 'Status da conta',
      icon: 'solar:user-linear',
      value: user.status,
      hint: `Função: ${user.role.name}`,
      badge: true,
      badgeVariant:
        user.status === 'ACTIVE'
          ? 'success'
          : user.status === 'SUSPENDED'
            ? 'destructive'
            : 'secondary'
    },
    {
      label: 'Verificação de email',
      icon: user.emailVerified ? 'solar:check-circle-linear' : 'solar:close-circle-linear',
      value: user.emailVerified ? 'Verificado' : 'Não verificado',
      hint: user.email
    },
    {
      label: 'Verificação de telefone',
      icon: user.phoneVerified ? 'solar:check-circle-linear' : 'solar:close-circle-linear',
      value: user.phoneVerified ? 'Verificado' : 'Não verificado',
      hint: user.phoneNumber || 'Sem número de telefone'
    },
    {
      label: 'Segurança',
      icon: 'solar:shield-check-linear',
      value: securityLevel,
      hint: 'Nível de segurança da conta'
    },
    {
      label: 'Última atividade',
      icon: 'solar:pulse-linear',
      value: formatDateTime(user.updatedAt),
      hint: 'Perfil atualizado pela última vez'
    },
    {
      label: 'Membro desde',
      icon: 'solar:calendar-linear',
      value: formatDateTime(user.createdAt),
      hint: 'Conta criada'
    }
  ] as const

  return (
    <>
      <div className="border-zinc-100 border-b px-6 py-8">
        <h1 className="font-medium text-2xl text-zinc-900 tracking-tight">
          Bem-vindo(a) de volta, {displayName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Visão geral da sua conta e atividade.</p>
      </div>

      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-xs text-zinc-500">{stat.label}</span>
                <iconify-icon
                  icon={stat.icon}
                  stroke-width="1.5"
                  className="text-base text-zinc-400"
                />
              </div>
              {'badge' in stat && stat.badge ? (
                <Badge variant={stat.badgeVariant as 'success' | 'destructive' | 'secondary'}>
                  {stat.value}
                </Badge>
              ) : (
                <div className="font-semibold text-lg text-zinc-900 tracking-tight">
                  {stat.value}
                </div>
              )}
              <p className="mt-2 text-xs text-zinc-500">{stat.hint}</p>
            </div>
          ))}
        </div>

        {canManageUsers(user.role.name) && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
              <h3 className="font-medium text-sm text-zinc-900 tracking-tight">Ações rápidas</h3>
            </div>
            <div className="flex flex-wrap gap-3 p-5">
              <Button asChild>
                <Link href="/users">Gerenciar usuários</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/facilities">Ver unidades de saúde</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/registry-suggestions">Revisar sugestões</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
