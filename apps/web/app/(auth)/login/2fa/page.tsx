'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { totpCodeSchema } from '@/lib/validators'

const verify2FASchema = z.object({
  code: totpCodeSchema
})

type Verify2FAForm = z.infer<typeof verify2FASchema>

export default function Verify2FALoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <Verify2FALoginInner />
    </Suspense>
  )
}

function Verify2FALoginInner() {
  const searchParams = useSearchParams()
  const pendingToken = searchParams.get('pending')
  const { complete2FALogin } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<Verify2FAForm>({
    resolver: zodResolver(verify2FASchema)
  })

  const onSubmit = async (data: Verify2FAForm) => {
    if (!pendingToken) {
      setError('Sessão de verificação ausente. Entre novamente.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await complete2FALogin({ pendingToken, code: data.code })
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } }
      const message =
        apiError.response?.data?.error || 'Invalid verification code. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!pendingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-semibold text-xl text-zinc-900 tracking-tighter">ATLASMED</h1>
            <p className="mt-2 text-sm text-zinc-500">Operações Comerciais em Saúde</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <h2 className="font-medium text-lg text-zinc-900">Sessão de verificação expirada</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Recomece pela página de login para continuar.
            </p>
            <div className="mt-6">
              <Link href="/login" className="font-medium text-blue-600 text-sm hover:underline">
                Back to sign in
              </Link>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500">&copy; AtlasMed 2026</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-semibold text-xl text-zinc-900 tracking-tighter">ATLASMED</h1>
          <p className="mt-2 text-sm text-zinc-500">Healthcare Commercial Operations</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-medium text-lg text-zinc-900">Autenticação de dois fatores</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Digite o código de 6 dígitos do seu aplicativo autenticador
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-3 text-red-600 text-sm">
                <iconify-icon
                  icon="solar:danger-circle-linear"
                  stroke-width="1.5"
                  className="mt-0.5 text-base"
                />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Código de autenticação</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                {...register('code')}
                disabled={isLoading}
              />
              {errors.code && <p className="text-red-600 text-xs">{errors.code.message}</p>}
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? 'Verificando...' : 'Verificar e entrar'}
            </Button>

            <Link
              href="/login"
              className="block text-center font-medium text-blue-600 text-sm hover:underline"
            >
              Voltar para o login
            </Link>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">&copy; AtlasMed 2026</p>
      </div>
    </div>
  )
}
