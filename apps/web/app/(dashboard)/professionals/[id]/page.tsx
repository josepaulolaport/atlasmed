'use client'

import type { ProfessionalProfile, UpdateProfessionalInput } from '@atlasmed/access'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { LinkedFacilitiesCard } from '@/components/professionals/linked-facilities-card'
import { ProfessionalProfileForm } from '@/components/professionals/professional-profile-form'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { getApiErrorMessage } from '@/lib/api/errors'
import { professionalsApi } from '@/lib/api/professionals'
import { canReadProfessionals, canUpdateProfessionals } from '@/lib/permissions'

export default function ProfessionalDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const professionalId = params.id

  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const canRead = user ? canReadProfessionals(user.role.name) : false
  const canEdit = user ? canUpdateProfessionals(user.role.name) : false

  const loadProfessional = useCallback(async () => {
    setLoading(true)
    try {
      const data = await professionalsApi.getProfessional(professionalId)
      setProfessional(data)
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao carregar profissional'),
        variant: 'destructive'
      })
      setProfessional(null)
    } finally {
      setLoading(false)
    }
  }, [professionalId, toast])

  useEffect(() => {
    if (user && !canRead) {
      router.replace('/unauthorized')
    }
  }, [user, canRead, router])

  useEffect(() => {
    if (!canRead) return
    void loadProfessional()
  }, [canRead, loadProfessional])

  const handleSaveProfile = async (values: UpdateProfessionalInput) => {
    setSaving(true)
    try {
      const updated = await professionalsApi.updateProfessional(professionalId, values)
      setProfessional(updated)
      toast({ title: 'Saved', description: 'Professional profile updated' })
    } catch (error) {
      toast({
        title: 'Erro',
        description: getApiErrorMessage(error, 'Falha ao atualizar profissional'),
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (!canRead) {
    return null
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
  }

  if (!professional) {
    return (
      <div className="py-10 text-center text-sm text-zinc-500">Profissional não encontrado</div>
    )
  }

  const displayName =
    professional.fullName?.trim() || `${professional.firstName} ${professional.lastName}`.trim()

  return (
    <>
      <div className="border-zinc-100 border-b px-6 py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/professionals">
                <iconify-icon
                  icon="solar:arrow-left-linear"
                  stroke-width="1.5"
                  className="text-base"
                />
                Voltar
              </Link>
            </Button>
            <div>
              <h1 className="font-medium text-2xl text-zinc-900 tracking-tight">{displayName}</h1>
              <p className="mt-1 text-sm text-zinc-500">Perfil do profissional</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <ProfessionalProfileForm
            professional={professional}
            canEdit={canEdit}
            saving={saving}
            onSubmit={handleSaveProfile}
          />
          <LinkedFacilitiesCard
            facilities={professional.facilities}
            professionalId={professional.id}
          />
        </div>
      </div>
    </>
  )
}
