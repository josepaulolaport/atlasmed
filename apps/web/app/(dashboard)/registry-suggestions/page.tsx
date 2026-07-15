'use client'

import { environment } from '@atlasmed/config'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { registryApi } from '@/lib/api/registry'
import { hasMinimumRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { RegistryDemoResult, RegistrySuggestion } from '@/types/facility'

const TYPE_LABELS: Record<RegistrySuggestion['type'], string> = {
  FACILITY_REGISTRY_DEACTIVATED: 'Desativação de unidade',
  FACILITY_REGISTRY_REACTIVATED: 'Reativação de unidade',
  DOCTOR_FACILITY_REGISTRY_DEACTIVATED: 'Remoção de profissional'
}

const DOT_COLOR: Record<RegistrySuggestion['type'], string> = {
  FACILITY_REGISTRY_DEACTIVATED: 'bg-amber-500',
  FACILITY_REGISTRY_REACTIVATED: 'bg-emerald-500',
  DOCTOR_FACILITY_REGISTRY_DEACTIVATED: 'bg-blue-500'
}

function getPayloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function getFacilityLabel(suggestion: RegistrySuggestion): string {
  return (
    getPayloadString(suggestion.payload, 'name') ||
    getPayloadString(suggestion.payload, 'externalSourceId') ||
    suggestion.facilityId ||
    '—'
  )
}

function getProfessionalLabel(suggestion: RegistrySuggestion): string | undefined {
  const firstName = getPayloadString(suggestion.payload, 'firstName')
  const lastName = getPayloadString(suggestion.payload, 'lastName')
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ')
  }
  return getPayloadString(suggestion.payload, 'doctorExternalSourceId') || suggestion.professionalId
}

export default function RegistrySuggestionsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [suggestions, setSuggestions] = useState<RegistrySuggestion[]>([])
  const [history, setHistory] = useState<RegistrySuggestion[]>([])
  const [demoResult, setDemoResult] = useState<RegistryDemoResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningDemo, setRunningDemo] = useState(false)

  const loadSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      const [pending, resolved] = await Promise.all([
        registryApi.getSuggestions({ status: 'PENDING', limit: 100 }),
        registryApi.getSuggestions({ limit: 20 })
      ])
      setSuggestions(pending.data)
      setHistory(resolved.data.filter((s) => s.status !== 'PENDING').slice(0, 10))
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar sugestões de cadastro',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

  const handleApprove = async (id: string) => {
    try {
      await registryApi.approveSuggestion(id)
      toast({ title: 'Aprovado', description: 'Sugestão aplicada' })
      await loadSuggestions()
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao aprovar sugestão',
        variant: 'destructive'
      })
    }
  }

  const handleReject = async (id: string) => {
    try {
      await registryApi.rejectSuggestion(id)
      toast({ title: 'Descartado', description: 'Sugestão rejeitada' })
      await loadSuggestions()
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao rejeitar sugestão',
        variant: 'destructive'
      })
    }
  }

  const handleRunDemo = async () => {
    setRunningDemo(true)
    try {
      const result = await registryApi.runDemoScenario()
      setDemoResult(result)
      setSuggestions(result.pendingSuggestions)
      toast({
        title: 'Cenário de demonstração concluído',
        description: `${result.summary.pendingCount} sugestão(ões) gerada(s)`
      })
    } catch {
      toast({
        title: 'Erro',
        description: 'Falha ao executar cenário de demonstração',
        variant: 'destructive'
      })
    } finally {
      setRunningDemo(false)
    }
  }

  const isAdmin = user && hasMinimumRole(user.role.name, 'ADMIN')

  return (
    <>
      <div className="border-zinc-100 border-b px-6 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="font-medium text-2xl text-zinc-900 tracking-tight">
              Sugestões de cadastro
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Revise as alterações de unidades e profissionais originadas da fonte antes de
              aplicá-las.
            </p>
          </div>
          {isAdmin && environment.NODE_ENV === 'development' && (
            <Button onClick={handleRunDemo} disabled={runningDemo}>
              <iconify-icon icon="solar:play-circle-linear" stroke-width="1.5" />
              {runningDemo ? 'Executando…' : 'Executar cenário de demonstração'}
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <iconify-icon
            icon="solar:info-circle-linear"
            stroke-width="1.5"
            className="mt-0.5 text-lg text-zinc-400"
          />
          <div>
            <h4 className="font-medium text-sm text-zinc-900">Revisão de cadastro</h4>
            <p className="mt-1 text-sm text-zinc-500">
              Os dados do CNES são importados e comparados com a verdade do seu CRM. Aprove ou
              rejeite as alterações sugeridas abaixo. Suas edições manuais são sempre protegidas e
              nunca sobrescritas silenciosamente.
            </p>
          </div>
        </div>

        {demoResult && (
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-zinc-200 border-b bg-zinc-50/50 px-5 py-3">
              <h3 className="font-medium text-sm text-zinc-900 tracking-tight">
                Última execução de demonstração
              </h3>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">
                  {demoResult.summary.pendingCount}{' '}
                  {demoResult.summary.pendingCount === 1 ? 'pendente' : 'pendentes'}
                </Badge>
                <Badge variant="secondary">
                  {demoResult.summary.clinicRemovals}{' '}
                  {demoResult.summary.clinicRemovals === 1
                    ? 'remoção de unidade'
                    : 'remoções de unidade'}
                </Badge>
                <Badge variant="secondary">
                  {demoResult.summary.doctorClinicRemovals}{' '}
                  {demoResult.summary.doctorClinicRemovals === 1
                    ? 'vínculo de profissional'
                    : 'vínculos de profissional'}
                </Badge>
              </div>
              <ul className="space-y-1 text-sm text-zinc-600">
                {demoResult.steps.map((step) => (
                  <li key={step.fixture}>
                    {step.skipped
                      ? `${step.label} — ignorado (${step.reason})`
                      : `${step.label}${
                          typeof step.suggestionsCreated === 'number' && step.suggestionsCreated > 0
                            ? ` — ${step.suggestionsCreated} sugestão(ões) criada(s)`
                            : ''
                        }`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">Carregando sugestões…</div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
            <iconify-icon
              icon="solar:check-circle-linear"
              stroke-width="1.5"
              className="text-3xl text-emerald-500"
            />
            <h4 className="mt-3 font-medium text-sm text-zinc-900">Nenhuma sugestão pendente</h4>
            <p className="mt-1 text-sm text-zinc-500">
              {isAdmin
                ? 'Execute o cenário de demonstração para gerar itens de exemplo.'
                : 'Você está em dia.'}
            </p>
          </div>
        ) : (
          suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onApprove={() => handleApprove(s.id)}
              onReject={() => handleReject(s.id)}
            />
          ))
        )}

        {history.length > 0 && (
          <div className="mt-12">
            <h3 className="mb-4 font-medium text-sm text-zinc-900 tracking-tight">
              Atividade recente de cadastro
            </h3>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-zinc-200 border-b bg-zinc-50">
                    <th className="w-1/4 px-4 py-2.5 font-medium text-xs text-zinc-500">Evento</th>
                    <th className="w-1/4 px-4 py-2.5 font-medium text-xs text-zinc-500">
                      Entidade
                    </th>
                    <th className="w-1/4 px-4 py-2.5 font-medium text-xs text-zinc-500">
                      Resolução
                    </th>
                    <th className="w-1/4 px-4 py-2.5 font-medium text-xs text-zinc-500">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-sm text-zinc-700">
                  {history.map((h) => (
                    <tr key={h.id} className="transition-colors hover:bg-zinc-50/50">
                      <td className="flex items-center gap-2 px-4 py-3">
                        <iconify-icon
                          icon={
                            h.status === 'APPROVED'
                              ? 'solar:check-circle-linear'
                              : 'solar:close-circle-linear'
                          }
                          className={cn(
                            'text-base',
                            h.status === 'APPROVED' ? 'text-emerald-500' : 'text-zinc-400'
                          )}
                        />
                        {TYPE_LABELS[h.type]}
                      </td>
                      <td className="px-4 py-3 text-zinc-900">
                        {getProfessionalLabel(h) ?? getFacilityLabel(h)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={h.status === 'APPROVED' ? 'success' : 'secondary'}>
                          {h.status.charAt(0) + h.status.slice(1).toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(h.resolvedAt ?? h.suggestedAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function SuggestionCard({
  suggestion,
  onApprove,
  onReject
}: {
  suggestion: RegistrySuggestion
  onApprove: () => void
  onReject: () => void
}) {
  const facilityLabel = useMemo(() => getFacilityLabel(suggestion), [suggestion])
  const professionalLabel = useMemo(() => getProfessionalLabel(suggestion), [suggestion])

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-zinc-200 border-b bg-zinc-50/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', DOT_COLOR[suggestion.type])} />
          <h3 className="font-medium text-sm text-zinc-900">{TYPE_LABELS[suggestion.type]}</h3>
          <span className="ml-2 text-xs text-zinc-400">
            Execução #{suggestion.ingestionRunId.slice(0, 8)} •{' '}
            {new Date(suggestion.suggestedAt).toLocaleString('pt-BR')}
          </span>
        </div>
        <Badge variant="secondary">Pendente</Badge>
      </div>

      <div className="grid grid-cols-1 divide-y divide-zinc-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-sm text-zinc-700">
              <iconify-icon icon="solar:lock-linear" stroke-width="1.5" className="text-zinc-400" />
              Verdade atual do CRM
            </div>
          </div>
          <div className="space-y-3">
            <FieldRow label="Unidade de saúde" value={facilityLabel} />
            {professionalLabel && <FieldRow label="Profissional" value={professionalLabel} />}
            <FieldRow label="Motivo" value={suggestion.reason || 'Divergência de cadastro'} />
          </div>
        </div>

        <div className="relative bg-blue-50/20 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-blue-700 text-sm">
              <iconify-icon
                icon="solar:magic-stick-3-linear"
                stroke-width="1.5"
                className="text-blue-500"
              />
              Sugestão de cadastro
            </div>
          </div>
          <div className="space-y-3">
            <FieldRow label="Ação" value={TYPE_LABELS[suggestion.type]} highlight />
            <div>
              <div className="mb-1 block font-medium text-blue-600/70 text-xs">Payload</div>
              <pre className="max-h-40 overflow-auto rounded-md border border-blue-200 bg-white p-3 text-xs text-zinc-700">
                {JSON.stringify(suggestion.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-zinc-200 border-t bg-white px-5 py-4">
        <Button variant="ghost" onClick={onReject}>
          Descartar
        </Button>
        <Button onClick={onApprove}>Aplicar sugestão</Button>
      </div>
    </div>
  )
}

function FieldRow({
  label,
  value,
  highlight
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <div className="mb-1 block font-medium text-xs text-zinc-500">{label}</div>
      <div
        className={cn(
          'rounded-md border px-3 py-2 text-sm text-zinc-900',
          highlight
            ? 'border-blue-200 bg-blue-50 shadow-sm ring-1 ring-blue-500/20'
            : 'border-zinc-200 bg-white'
        )}
      >
        {value}
      </div>
    </div>
  )
}
