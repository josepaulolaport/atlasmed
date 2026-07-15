'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/hooks/use-toast'
import { verificationApi } from '@/lib/api/verification'
import { verifyPhoneSchema } from '@/lib/validators'

type VerifyPhoneForm = z.infer<typeof verifyPhoneSchema>

export default function VerifyPhonePage() {
  const router = useRouter()
  const { refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<VerifyPhoneForm>({
    resolver: zodResolver(verifyPhoneSchema)
  })

  const onSubmit = async (data: VerifyPhoneForm) => {
    setLoading(true)
    setError(null)

    try {
      await verificationApi.verifyPhone({ token: data.code })
      await refreshUser()
      toast({
        title: 'Sucesso',
        description: 'Telefone verificado com sucesso',
        variant: 'success'
      })
      router.push('/security')
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: { message?: string } } } }
      setError(apiError.response?.data?.error?.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Verificar telefone</CardTitle>
          <CardDescription>Insira o código de 6 dígitos enviado ao seu telefone.</CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <p>{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Código de verificação</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                {...form.register('code')}
                disabled={loading}
              />
              {form.formState.errors.code && (
                <p className="text-red-600 text-sm">{form.formState.errors.code.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verificando...' : 'Verificar telefone'}
            </Button>
            <Link href="/security" className="text-blue-600 text-sm hover:underline">
              Voltar para configurações de segurança
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
