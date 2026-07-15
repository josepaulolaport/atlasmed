'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { usersApi } from '@/lib/api/users'
import type { User } from '@/types/auth'

interface ManagerSelectorProps {
  value?: string
  onChange: (managerId: string | undefined) => void
  disabled?: boolean
  error?: string
  required?: boolean
}

export function ManagerSelector({
  value,
  onChange,
  disabled = false,
  error,
  required = false
}: ManagerSelectorProps) {
  const [managers, setManagers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const fetchManagers = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await usersApi.getManagers()
        setManagers(data)
      } catch (err) {
        setLoadError('Falha ao carregar gerentes')
        console.error('Failed to fetch managers:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchManagers()
  }, [])

  const getManagerDisplayName = (manager: User): string => {
    if (manager.firstName && manager.lastName) {
      return `${manager.firstName} ${manager.lastName}`
    }
    return manager.username
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="manager">Gerente {required && <span className="text-red-600">*</span>}</Label>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando gerentes...</span>
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <p>{loadError}</p>
        </div>
      ) : (
        <>
          <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled || managers.length === 0}
          >
            <SelectTrigger id="manager" className="w-full">
              <SelectValue placeholder="Selecione um gerente" />
            </SelectTrigger>
            <SelectContent>
              {managers.length === 0 ? (
                <SelectItem value="_empty" disabled>
                  Nenhum gerente disponível
                </SelectItem>
              ) : (
                managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{getManagerDisplayName(manager)}</span>
                      <span className="text-gray-500 text-xs">{manager.email}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <p className="text-gray-500 text-xs">
            Atribua um gerente que supervisionará este representante de campo
          </p>
        </>
      )}
    </div>
  )
}
