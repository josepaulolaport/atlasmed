'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ManagerSelector } from '@/components/invite/manager-selector'
import { TerritorySelector } from '@/components/invite/territory-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { toast } from '@/hooks/use-toast'
import { usersApi } from '@/lib/api/users'
import { canManageUsers } from '@/lib/permissions'
import { inviteUserSchema } from '@/lib/validators'
import type { InviteUserRequest, RoleInfo } from '@/types/auth'

export default function InviteUserPage() {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<InviteUserRequest>({
    resolver: zodResolver(inviteUserSchema)
  })

  const watchedRoleId = watch('roleId')
  const watchedManagerId = watch('managerId')

  useEffect(() => {
    if (currentUser && !canManageUsers(currentUser.role.name)) {
      router.push('/unauthorized')
      return
    }

    const fetchRoles = async () => {
      try {
        const rolesData = await usersApi.getRoles()
        setRoles(rolesData)
      } catch (err) {
        toast({
          title: 'Erro',
          description: 'Falha ao carregar funções',
          variant: 'destructive'
        })
      } finally {
        setLoadingRoles(false)
      }
    }

    fetchRoles()
  }, [currentUser, router])

  useEffect(() => {
    setSelectedRoleId(watchedRoleId || '')

    // Clear territory/manager fields when role changes
    if (watchedRoleId) {
      const role = roles.find((r) => r.id === watchedRoleId)
      if (role) {
        // Clear fields that don't apply to the new role
        if (role.name !== 'MANAGER') {
          setValue('managerTerritoryId', undefined)
        }
        if (role.name !== 'REP') {
          setValue('managerId', undefined)
          setValue('repTerritoryId', undefined)
        }
      }
    }
  }, [watchedRoleId, roles, setValue])

  const getSelectedRole = (): RoleInfo | undefined => {
    return roles.find((r) => r.id === selectedRoleId)
  }

  const validateRoleRequirements = (data: InviteUserRequest): string[] => {
    const errors: string[] = []
    const role = getSelectedRole()

    if (!role) return errors

    if (role.name === 'MANAGER' && !data.managerTerritoryId) {
      errors.push('Território do gerente é obrigatório para função MANAGER')
    }

    if (role.name === 'REP') {
      if (!data.managerId) {
        errors.push('Gerente é obrigatório para função REP')
      }
      if (!data.repTerritoryId) {
        errors.push('Território do representante é obrigatório para função REP')
      }
    }

    return errors
  }

  const onSubmit = async (data: InviteUserRequest) => {
    setIsLoading(true)
    setError(null)

    // Validate role-specific requirements
    const validationErrors = validateRoleRequirements(data)
    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '))
      setIsLoading(false)
      return
    }

    try {
      await usersApi.inviteUser(data)
      toast({
        title: 'Sucesso',
        description: 'Convite enviado com sucesso'
      })
      router.push('/users/invites')
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } }
      setError(error.response?.data?.error || 'Falha ao enviar convite')
    } finally {
      setIsLoading(false)
    }
  }

  if (!currentUser || !canManageUsers(currentUser.role.name)) {
    return null
  }

  const selectedRole = getSelectedRole()
  const showManagerFields = selectedRole?.name === 'MANAGER'
  const showRepFields = selectedRole?.name === 'REP'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Usuários
          </Button>
        </Link>
        <h1 className="mt-4 font-bold text-3xl text-gray-900">Convidar usuário</h1>
        <p className="mt-2 text-gray-600">
          Envie um convite para um novo usuário entrar na plataforma
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do convite</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Informações de Contato</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Endereço de email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    {...register('email')}
                    disabled={isLoading}
                  />
                  {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Telefone (Opcional)</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+5511999999999"
                    {...register('phoneNumber')}
                    disabled={isLoading}
                  />
                  {errors.phoneNumber && (
                    <p className="text-red-600 text-sm">{errors.phoneNumber.message}</p>
                  )}
                </div>
              </div>

              <p className="text-gray-500 text-xs">
                O convite será enviado por email. O telefone pode ser usado para envio via WhatsApp.
              </p>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Informações Pessoais</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    Primeiro Nome <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="João"
                    {...register('firstName')}
                    disabled={isLoading}
                  />
                  {errors.firstName && (
                    <p className="text-red-600 text-sm">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Sobrenome <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Silva"
                    {...register('lastName')}
                    disabled={isLoading}
                  />
                  {errors.lastName && (
                    <p className="text-red-600 text-sm">{errors.lastName.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Função e Permissões</h3>

              <div className="space-y-2">
                <Label htmlFor="roleId">
                  Função <span className="text-red-600">*</span>
                </Label>
                <select
                  id="roleId"
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('roleId')}
                  disabled={isLoading || loadingRoles}
                >
                  <option value="">Selecione uma função</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {errors.roleId && <p className="text-red-600 text-sm">{errors.roleId.message}</p>}
                {selectedRole && (
                  <p className="text-gray-600 text-xs">
                    {selectedRole.description || 'Nenhuma descrição disponível'}
                  </p>
                )}
              </div>
            </div>

            {/* Manager-specific fields */}
            {showManagerFields && (
              <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-medium text-blue-900 text-lg">Atribuições de Gerente</h3>
                <TerritorySelector
                  value={watch('managerTerritoryId')}
                  onChange={(id) => setValue('managerTerritoryId', id)}
                  territoryType="manager_zone"
                  disabled={isLoading}
                  error={errors.managerTerritoryId?.message}
                  required
                />
              </div>
            )}

            {/* Rep-specific fields */}
            {showRepFields && (
              <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <h3 className="font-medium text-green-900 text-lg">Atribuições de Representante</h3>

                <ManagerSelector
                  value={watch('managerId')}
                  onChange={(id) => setValue('managerId', id)}
                  disabled={isLoading}
                  error={errors.managerId?.message}
                  required
                />

                <TerritorySelector
                  value={watch('repTerritoryId')}
                  onChange={(id) => setValue('repTerritoryId', id)}
                  territoryType="patch"
                  managerTerritoryId={watchedManagerId}
                  disabled={isLoading || !watchedManagerId}
                  error={errors.repTerritoryId?.message}
                  required
                />
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading || loadingRoles}>
                {isLoading ? 'Enviando...' : 'Enviar convite'}
              </Button>
              <Link href="/users">
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      {!loadingRoles && roles.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Referência de Funções</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {roles.map((role) => (
                <div key={role.id} className="border-b pb-3 last:border-0">
                  <h4 className="font-medium text-gray-900">{role.name}</h4>
                  <p className="text-gray-600">
                    {role.description || 'Nenhuma descrição disponível'}
                  </p>
                  {role.name === 'MANAGER' && (
                    <p className="mt-1 text-blue-600 text-xs">
                      • Requer atribuição de zona de gerente
                    </p>
                  )}
                  {role.name === 'REP' && (
                    <p className="mt-1 text-green-600 text-xs">
                      • Requer gerente e território de representante
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
