'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api/auth'
import { passwordResetSchema } from '@/lib/validators'
import type { PasswordResetConfirm } from '@/types/auth'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<PasswordResetConfirm>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: {
      token
    }
  })

  const password = watch('password')

  const passwordRequirements = [
    { label: 'Pelo menos 8 caracteres', test: (p: string) => p.length >= 8 },
    { label: 'Uma letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Uma letra minúscula', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Um número', test: (p: string) => /[0-9]/.test(p) },
    {
      label: 'Um caractere especial',
      test: (p: string) => /[^A-Za-z0-9]/.test(p)
    }
  ]

  const onSubmit = async (data: PasswordResetConfirm) => {
    setIsLoading(true)
    setError(null)

    try {
      await authApi.resetPassword(data)
      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(
        error.response?.data?.message || 'Failed to reset password. The link may be expired.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-semibold text-xl text-zinc-900 tracking-tighter">ATLASMED</h1>
            <p className="mt-2 text-sm text-zinc-500">Operações Comerciais em Saúde</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="font-medium text-lg text-red-600">Link de redefinição inválido</h2>
            <p className="mt-1 text-sm text-zinc-500">
              O link de redefinição de senha está ausente ou é inválido.
            </p>
            <div className="mt-6">
              <Link href="/forgot-password" className="block">
                <Button variant="primary" className="w-full">
                  Solicitar novo link
                </Button>
              </Link>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500">&copy; AtlasMed 2026</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="font-semibold text-xl text-zinc-900 tracking-tighter">ATLASMED</h1>
            <p className="mt-2 text-sm text-zinc-500">Operações Comerciais em Saúde</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <iconify-icon
                icon="solar:check-circle-linear"
                stroke-width="1.5"
                className="text-2xl"
              />
            </div>
            <h2 className="font-medium text-lg text-zinc-900">Senha redefinida com sucesso</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sua senha foi redefinida. Redirecionando para o login...
            </p>
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
          <h2 className="font-medium text-lg text-zinc-900">Redefinir sua senha</h2>
          <p className="mt-1 text-sm text-zinc-500">Digite sua nova senha abaixo.</p>
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
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua nova senha"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && <p className="text-red-600 text-xs">{errors.password.message}</p>}

              {password && (
                <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="font-medium text-xs text-zinc-700">Requisitos da senha</p>
                  <ul className="space-y-1">
                    {passwordRequirements.map((req, index) => {
                      const passed = req.test(password)
                      return (
                        <li key={index} className="flex items-center gap-2 text-xs">
                          <iconify-icon
                            icon={
                              passed ? 'solar:check-circle-linear' : 'solar:close-circle-linear'
                            }
                            stroke-width="1.5"
                            className={
                              passed ? 'text-emerald-600 text-sm' : 'text-sm text-zinc-400'
                            }
                          />
                          <span className={passed ? 'text-emerald-700' : 'text-zinc-500'}>
                            {req.label}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? 'Redefinindo senha...' : 'Redefinir senha'}
            </Button>

            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full">
                Voltar para o login
              </Button>
            </Link>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">&copy; AtlasMed 2026</p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
