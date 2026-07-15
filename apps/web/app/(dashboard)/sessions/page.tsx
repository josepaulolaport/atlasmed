'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { authApi } from '@/lib/api/auth'
import { formatDateTime } from '@/lib/utils'
import type { Session } from '@/types/auth'

const deviceIcons: Record<Session['deviceType'], string> = {
  DESKTOP: 'solar:monitor-linear',
  MOBILE: 'solar:smartphone-linear',
  TABLET: 'solar:tablet-linear',
  UNKNOWN: 'solar:question-circle-linear'
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await authApi.getSessions()
        setSessions(data)
      } catch {
        toast({
          title: 'Erro',
          description: 'Falha ao carregar sessões',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    loadSessions()
  }, [])

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Tem certeza de que deseja revogar esta sessão?')) {
      return
    }

    setRevokingId(sessionId)

    try {
      await authApi.revokeSession(sessionId)
      toast({
        title: 'Sucesso',
        description: 'Sessão revogada com sucesso',
        variant: 'success'
      })

      const data = await authApi.getSessions()
      setSessions(data)
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao revogar sessão',
        variant: 'destructive'
      })
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <>
      <div className="border-zinc-100 border-b px-6 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="font-medium text-2xl text-zinc-900 tracking-tight">Sessões ativas</h1>
            <p className="mt-1 text-sm text-zinc-500">Gerencie suas sessões ativas e a segurança</p>
          </div>
          {sessions.some((session) => !session.isCurrent) && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm('Sair de todos os outros dispositivos?')) {
                  return
                }

                try {
                  const result = await authApi.revokeOtherSessions()
                  toast({
                    title: 'Sucesso',
                    description:
                      result.revokedCount > 0
                        ? `Sessões encerradas em ${result.revokedCount} outro(s) dispositivo(s)`
                        : 'Nenhuma outra sessão ativa encontrada',
                    variant: 'success'
                  })
                  const data = await authApi.getSessions()
                  setSessions(data)
                } catch {
                  toast({
                    title: 'Erro',
                    description: 'Falha ao encerrar sessões em outros dispositivos',
                    variant: 'destructive'
                  })
                }
              }}
            >
              Sair dos outros dispositivos
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <iconify-icon
                icon="solar:question-circle-linear"
                stroke-width="1.5"
                className="text-2xl"
              />
            </div>
            <p className="text-sm text-zinc-500">Nenhuma sessão ativa encontrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => {
              const deviceIcon = deviceIcons[session.deviceType]
              return (
                <div
                  key={session.id}
                  className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                    session.isCurrent ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                          <iconify-icon icon={deviceIcon} stroke-width="1.5" className="text-xl" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-zinc-900 tracking-tight">
                              {session.browserName || 'Navegador desconhecido'}
                            </span>
                            {session.isCurrent && <Badge variant="success">Atual</Badge>}
                            {session.suspiciousActivity && (
                              <Badge variant="destructive">
                                <iconify-icon
                                  icon="solar:danger-triangle-linear"
                                  stroke-width="1.5"
                                  className="mr-1 text-xs"
                                />
                                Suspeita
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-zinc-500">
                            {session.browserVersion && <p>Versão: {session.browserVersion}</p>}
                            {session.osName && <p>SO: {session.osName}</p>}
                            <p className="flex items-center gap-1">
                              <iconify-icon
                                icon="solar:map-point-linear"
                                stroke-width="1.5"
                                className="text-sm"
                              />
                              {session.ipAddress || 'Local desconhecido'}
                            </p>
                            <p className="flex items-center gap-1">
                              <iconify-icon
                                icon="solar:clock-circle-linear"
                                stroke-width="1.5"
                                className="text-sm"
                              />
                              Última atividade: {formatDateTime(session.lastSeenAt)}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Criada em: {formatDateTime(session.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revokingId === session.id}
                        >
                          <iconify-icon
                            icon="solar:trash-bin-trash-linear"
                            stroke-width="1.5"
                            className="text-base"
                          />
                          {revokingId === session.id ? 'Revogando...' : 'Revogar'}
                        </Button>
                      )}
                    </div>
                    {session.suspiciousActivity && (
                      <div className="mt-4 rounded-md border border-red-100 bg-red-50 p-3 text-red-600 text-sm">
                        <p className="flex items-center gap-2">
                          <iconify-icon
                            icon="solar:danger-triangle-linear"
                            stroke-width="1.5"
                            className="text-base"
                          />
                          Esta sessão foi sinalizada por atividade suspeita. Se não foi você,
                          revogue-a imediatamente e altere sua senha.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-4">
            <h3 className="font-medium text-sm text-zinc-900 tracking-tight">Dicas de segurança</h3>
          </div>
          <div className="p-5">
            <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-600">
              <li>Sempre saia ao usar computadores públicos ou compartilhados</li>
              <li>
                Revise regularmente suas sessões ativas em busca de dispositivos não reconhecidos
              </li>
              <li>
                Se notar atividade suspeita, revogue a sessão e altere sua senha imediatamente
              </li>
              <li>Ative a verificação de email e telefone para mais segurança</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
