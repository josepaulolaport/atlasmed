'use client'

import { Label } from '@/components/ui/label'
import type { TerritoryTypeFlags } from '@/types/territory'

const FLAG_FIELDS: Array<{
  key: keyof TerritoryTypeFlags
  label: string
  description: string
}> = [
  {
    key: 'canHaveBoundary',
    label: 'Pode ter limite',
    description: 'Territórios deste tipo suportam limites de polígono.'
  },
  {
    key: 'assignsClinics',
    label: 'Atribui clínicas',
    description: 'Clínicas dentro do limite são atribuídas a este território.'
  },
  {
    key: 'assignableToUsers',
    label: 'Atribuível a usuários',
    description: 'Representantes de campo podem ser atribuídos a territórios deste tipo.'
  },
  {
    key: 'assignableToManagers',
    label: 'Atribuível a gestores',
    description: 'Gestores podem ser atribuídos a territórios deste tipo.'
  },
  {
    key: 'isCountryLevel',
    label: 'Nível de país',
    description: 'Território de país de nível superior; não pode ter um pai.'
  },
  {
    key: 'participatesInGroupingHierarchy',
    label: 'Hierarquia de agrupamento',
    description: 'Territórios deste tipo aparecem na árvore de agrupamento para filtros e análises.'
  },
  {
    key: 'blockSiblingOverlap',
    label: 'Bloquear sobreposição de irmãos',
    description: 'Rejeitar limites que se sobrepõem a irmãos do mesmo tipo.'
  }
]

interface TerritoryTypeFlagsFieldsProps {
  flags: TerritoryTypeFlags
  onChange: (flags: TerritoryTypeFlags) => void
  disabled?: boolean
  idPrefix?: string
}

export function TerritoryTypeFlagsFields({
  flags,
  onChange,
  disabled = false,
  idPrefix = 'type-flag'
}: TerritoryTypeFlagsFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FLAG_FIELDS.map((field) => (
        <label
          key={field.key}
          htmlFor={`${idPrefix}-${field.key}`}
          className="flex cursor-pointer items-start gap-2 rounded-md border p-3"
        >
          <input
            id={`${idPrefix}-${field.key}`}
            type="checkbox"
            className="mt-1"
            checked={Boolean(flags[field.key])}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...flags,
                [field.key]: e.target.checked
              })
            }
          />
          <span>
            <span className="block font-medium text-gray-900 text-sm">{field.label}</span>
            <span className="block text-gray-500 text-xs">{field.description}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

export const DEFAULT_TERRITORY_TYPE_FLAGS: TerritoryTypeFlags = {
  canHaveBoundary: true,
  assignsClinics: false,
  assignableToUsers: false,
  assignableToManagers: false,
  isCountryLevel: false,
  blockSiblingOverlap: false
}
