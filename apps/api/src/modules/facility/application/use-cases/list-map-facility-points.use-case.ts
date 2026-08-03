import type { ScopeContext } from "@atlasmed/access";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { buildFacilityListScope } from "../utils/facility-vertical-scope.utils";

interface Dependencies {
  facilityRepository: FacilityRepository;
}

export type MapFacilityPointsGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: {
      facilityId: string;
      name: string;
      purchaseBucket: "active" | "inactive" | "neverBought";
    };
  }>;
};

/** Thin scoped map pins for live-map client clustering. */
export class ListMapFacilityPointsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    scope: ScopeContext;
    role: string;
    verticalId?: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
  }): Promise<MapFacilityPointsGeoJson> {
    const listScope = buildFacilityListScope({
      scope: input.scope,
      role: input.role,
      verticalId: input.verticalId,
    });

    const points = await this.deps.facilityRepository.listMapPoints({
      scope: listScope,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
    });

    return {
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [point.lng, point.lat] as [number, number],
        },
        properties: {
          facilityId: point.id,
          name: point.name,
          purchaseBucket: point.purchaseBucket,
        },
      })),
    };
  }
}
