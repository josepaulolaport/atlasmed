'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { authApi } from '@/lib/api/auth'
import { inviteTokenSchema, registerSchema } from '@/lib/validators'
import type { RegisterRequest } from '@/types/auth'

type InviteTokenForm = z.infer<typeof inviteTokenSchema>

interface ValidatedInvite {
  email?: string
  phoneNumber?: string
  role: { id: string; name: string }
  expiresAt: string
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-semibold text-xl text-zinc-900 tracking-tighter">ATLASMED</h1>
          <p className="mt-2 text-sm text-zinc-500">Operações Comerciais em Saúde</p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-zinc-500">&copy; AtlasMed 2026</p>
      </div>
    </div>
  )
}

function RegisterForm() {
  const { register: registerUser } = useAuth()
  const searchParams = useSearchParams()
  const initialToken = searchParams.get('token') || ''

  const [validatedInvite, setValidatedInvite] = useState<ValidatedInvite | null>(null)
  const [registrationToken, setRegistrationToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokenForm = useForm<InviteTokenForm>({
    resolver: zodResolver(inviteTokenSchema),
    defaultValues: { token: initialToken }
  })

  const registerForm = useForm<RegisterRequest>({
    resolver: zodResolver(registerSchema),
    defaultValues: { token: '' }
  })

  const password = registerForm.watch('password')
  const canShowRegistrationForm = validatedInvite !== null && registrationToken.length > 0

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

  const resetToTokenStep = () => {
    setValidatedInvite(null)
    setRegistrationToken('')
    setError(null)
    registerForm.reset({ token: '' })
  }

  const handleValidateToken = async (data: InviteTokenForm) => {
    const token = data.token.trim()
    setIsLoading(true)
    setError(null)
    resetToTokenStep()

    try {
      const validated = await authApi.validateInviteToken(token)
      setRegistrationToken(token)
      setValidatedInvite(validated)
      registerForm.reset({
        token,
        email: validated.email || '',
        phoneNumber: validated.phoneNumber || ''
      })
    } catch {
      setError('Token de cadastro inválido, expirado ou já utilizado')
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmitRegistration = async (data: RegisterRequest) => {
    if (!canShowRegistrationForm) {
      setError('Valide seu token de cadastro antes de continuar')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await authApi.validateInviteToken(registrationToken)
      await registerUser({ ...data, token: registrationToken })
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } }
      const message =
        apiError.response?.data?.error?.message ||
        'Registration failed. Your token may have expired — validate it again.'

      if (message.toLowerCase().includes('invite') || message.toLowerCase().includes('token')) {
        resetToTokenStep()
      }

      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!canShowRegistrationForm) {
    return (
      <AuthShell>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="font-medium text-lg text-zinc-900">Junte-se ao AtlasMed</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Digite seu token de cadastro para continuar. Você recebeu este token por email ou SMS
            quando foi convidado.
          </p>
          <form onSubmit={tokenForm.handleSubmit(handleValidateToken)} className="mt-6 space-y-4">
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
              <Label htmlFor="token">Token de cadastro</Label>
              <Input
                id="token"
                type="text"
                placeholder="Cole seu token de convite"
                autoComplete="off"
                {...tokenForm.register('token')}
                disabled={isLoading}
              />
              {tokenForm.formState.errors.token && (
                <p className="text-red-600 text-xs">{tokenForm.formState.errors.token.message}</p>
              )}
            </div>

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? 'Validando...' : 'Continuar'}
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="font-medium text-lg text-zinc-900">Crie sua conta</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Conclua o cadastro para a função {validatedInvite.role.name}
        </p>
        <form onSubmit={registerForm.handleSubmit(onSubmitRegistration)} className="mt-6 space-y-4">
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

          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-emerald-800 text-sm">
            Token de cadastro verificado. O token expira em{' '}
            {new Date(validatedInvite.expiresAt).toLocaleString('pt-BR')}.
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...registerForm.register('email')}
              disabled={isLoading || Boolean(validatedInvite.email)}
            />
            {registerForm.formState.errors.email && (
              <p className="text-red-600 text-xs">{registerForm.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Nome de usuário</Label>
            <Input
              id="username"
              type="text"
              placeholder="Escolha um nome de usuário"
              {...registerForm.register('username')}
              disabled={isLoading}
            />
            {registerForm.formState.errors.username && (
              <p className="text-red-600 text-xs">
                {registerForm.formState.errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Escolha uma senha forte"
              {...registerForm.register('password')}
              disabled={isLoading}
            />
            {registerForm.formState.errors.password && (
              <p className="text-red-600 text-xs">
                {registerForm.formState.errors.password.message}
              </p>
            )}

            {password && (
              <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-xs text-zinc-700">Requisitos da senha</p>
                <ul className="space-y-1">
                  {passwordRequirements.map((req) => {
                    const passed = req.test(password)
                    return (
                      <li key={req.label} className="flex items-center gap-2 text-xs">
                        <iconify-icon
                          icon={passed ? 'solar:check-circle-linear' : 'solar:close-circle-linear'}
                          stroke-width="1.5"
                          className={passed ? 'text-emerald-600 text-sm' : 'text-sm text-zinc-400'}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="Opcional"
                {...registerForm.register('firstName')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Opcional"
                {...registerForm.register('lastName')}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Telefone</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder={validatedInvite.phoneNumber ? undefined : 'Opcional'}
              {...registerForm.register('phoneNumber')}
              disabled={isLoading || Boolean(validatedInvite.phoneNumber)}
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={resetToTokenStep}
            disabled={isLoading}
          >
            Usar outro token
          </Button>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <div className="py-10 text-center text-sm text-zinc-500">Carregando…</div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
