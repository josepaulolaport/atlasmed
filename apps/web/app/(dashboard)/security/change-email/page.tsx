'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { verificationApi } from '@/lib/api/verification'
import { changeEmailConfirmSchema, changeEmailSchema } from '@/lib/validators'

type ChangeEmailForm = z.infer<typeof changeEmailSchema>
type ConfirmEmailForm = z.infer<typeof changeEmailConfirmSchema>

export default function ChangeEmailPage() {
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestForm = useForm<ChangeEmailForm>({
    resolver: zodResolver(changeEmailSchema)
  })

  const confirmForm = useForm<ConfirmEmailForm>({
    resolver: zodResolver(changeEmailConfirmSchema)
  })

  const handleRequest = async (data: ChangeEmailForm) => {
    setLoading(true)
    setError(null)

    try {
      await verificationApi.requestEmailChange(data)
      confirmForm.setValue('newEmail', data.newEmail)
      toast({
        title: 'Check your inbox',
        description: 'We sent a confirmation link to your new email address.',
        variant: 'success'
      })
      setStep('confirm')
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } }
      setError(apiError.response?.data?.error?.message || 'Failed to request email change')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (data: ConfirmEmailForm) => {
    setLoading(true)
    setError(null)

    try {
      await verificationApi.confirmEmailChange(data)
      toast({
        title: 'Sucesso',
        description: 'Endereço de e-mail atualizado',
        variant: 'success'
      })
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } }
      setError(apiError.response?.data?.error?.message || 'Failed to confirm email change')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Alterar email</CardTitle>
          <CardDescription>
            {step === 'request'
              ? 'Solicite a alteração do email da sua conta.'
              : 'Insira o token de confirmação enviado ao seu novo email.'}
          </CardDescription>
        </CardHeader>

        {step === 'request' ? (
          <form onSubmit={requestForm.handleSubmit(handleRequest)}>
            <CardContent className="space-y-4">
              {error && <ErrorBox message={error} />}
              <div className="space-y-2">
                <Label htmlFor="newEmail">Novo email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  {...requestForm.register('newEmail')}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar confirmação'}
              </Button>
              <Link href="/security" className="text-blue-600 text-sm hover:underline">
                Voltar para configurações de segurança
              </Link>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={confirmForm.handleSubmit(handleConfirm)}>
            <CardContent className="space-y-4">
              {error && <ErrorBox message={error} />}
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">Novo email</Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  {...confirmForm.register('newEmail')}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmToken">Token de confirmação</Label>
                <Input id="confirmToken" {...confirmForm.register('token')} disabled={loading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Confirmando...' : 'Confirmar novo email'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('request')}
                disabled={loading}
              >
                Recomeçar
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-600 text-sm">
      <AlertCircle className="h-4 w-4" />
      <p>{message}</p>
    </div>
  )
}
