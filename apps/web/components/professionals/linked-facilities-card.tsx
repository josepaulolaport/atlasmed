import type { ProfessionalFacilitySummary } from '@atlasmed/access'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface LinkedFacilitiesCardProps {
  facilities: ProfessionalFacilitySummary[]
  professionalId?: string
}

export function LinkedFacilitiesCard({ facilities, professionalId }: LinkedFacilitiesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Unidades vinculadas</CardTitle>
      </CardHeader>
      <CardContent>
        {facilities.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum vínculo de unidade ativo</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {facilities.map((facility) => (
              <li key={facility.id}>
                {professionalId ? (
                  <Link
                    href={`/facilities/${facility.id}/professionals/${professionalId}`}
                    className="font-medium text-blue-600 text-sm hover:underline"
                  >
                    {facility.name}
                  </Link>
                ) : (
                  <Link
                    href={`/facilities/${facility.id}`}
                    className="font-medium text-blue-600 text-sm hover:underline"
                  >
                    {facility.name}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
