import Link from "next/link";
import type { ProfessionalFacilitySummary } from "@atlasmed/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LinkedFacilitiesCardProps {
  facilities: ProfessionalFacilitySummary[];
  professionalId?: string;
}

export function LinkedFacilitiesCard({
  facilities,
  professionalId,
}: LinkedFacilitiesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Linked facilities</CardTitle>
      </CardHeader>
      <CardContent>
        {facilities.length === 0 ? (
          <p className="text-sm text-gray-500">No active facility links</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {facilities.map((facility) => (
              <li key={facility.id}>
                {professionalId ? (
                  <Link
                    href={`/facilities/${facility.id}/professionals/${professionalId}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {facility.name}
                  </Link>
                ) : (
                  <Link
                    href={`/facilities/${facility.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
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
  );
}
