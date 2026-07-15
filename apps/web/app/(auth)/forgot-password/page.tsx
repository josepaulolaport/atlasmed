'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api/auth'
import { passwordResetRequestSchema } from '@/lib/validators'
import type { PasswordResetRequest } from '@/types/auth'

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<PasswordResetRequest>({
    resolver: zodResolver(passwordResetRequestSchema)
  })

  const onSubmit = async (data: PasswordResetRequest) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await authApi.requestPasswordReset(data)
      setSuccess(true)
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(
        error.response?.data?.message || 'Failed to send reset instructions. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
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
            <h2 className="font-medium text-lg text-zinc-900">Verifique seu email</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Se existir uma conta com as informações fornecidas, você receberá instruções para
              redefinir a senha em breve.
            </p>
            <div className="mt-6">
              <Link href="/login">
                <Button variant="outline">
                  <iconify-icon
                    icon="solar:arrow-left-linear"
                    stroke-width="1.5"
                    className="text-base"
                  />
                  Voltar para o login
                </Button>
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
          <p className="mt-2 text-sm text-zinc-500">Operações Comerciais em Saúde</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-medium text-lg text-zinc-900">Esqueceu a senha?</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Digite seu email, nome de usuário ou telefone e enviaremos as instruções para redefinir
            sua senha.
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
              <Label htmlFor="identifier">Email, usuário ou telefone</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="you@example.com"
                {...register('identifier')}
                disabled={isLoading}
              />
              {errors.identifier && (
                <p className="text-red-600 text-xs">{errors.identifier.message}</p>
              )}
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Enviar instruções'}
            </Button>

            <Link href="/login" className="block">
              <Button variant="ghost" className="w-full">
                <iconify-icon
                  icon="solar:arrow-left-linear"
                  stroke-width="1.5"
                  className="text-base"
                />
                Back to sign in
              </Button>
            </Link>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">&copy; AtlasMed 2026</p>
      </div>
    </div>
  )
}
