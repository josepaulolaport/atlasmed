'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { loginSchema } from '@/lib/validators'
import type { LoginRequest } from '@/types/auth'

function getLoginErrorMessage(err: unknown): { message: string; code?: string } {
  const error = err as {
    response?: { data?: { error?: { message?: string; code?: string } } }
  }
  return {
    message: error.response?.data?.error?.message || 'Invalid credentials',
    code: error.response?.data?.error?.code
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const { login } = useAuth()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('reason') === 'refresh_reuse') {
      setError('Sua sessão foi encerrada devido a atividade suspeita. Entre novamente.')
    }
  }, [searchParams])

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginRequest) => {
    setIsLoading(true)
    setError(null)

    try {
      await login(data)
    } catch (err) {
      const { message } = getLoginErrorMessage(err)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-semibold text-xl text-zinc-900 tracking-tighter">ATLASMED</h1>
          <p className="mt-2 text-sm text-zinc-500">Operações Comerciais em Saúde</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-medium text-lg text-zinc-900">Entrar</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Insira suas credenciais para acessar sua conta
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link href="/forgot-password" className="text-blue-600 text-xs hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && <p className="text-red-600 text-xs">{errors.password.message}</p>}
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>

            <p className="pt-2 text-center text-sm text-zinc-500">
              Novo no AtlasMed?{' '}
              <Link href="/register" className="font-medium text-blue-600 hover:underline">
                Cadastrar com token
              </Link>
            </p>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">&copy; AtlasMed 2026</p>
      </div>
    </div>
  )
}
