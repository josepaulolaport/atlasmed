import type { ScopeContext } from "@atlasmed/access";
import type {
  FacilityMapBounds,
  FacilityRepository,
} from "../interfaces/facility.repository.interface";
import { ValidationError } from "../../../../shared/errors";
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
      facilityId: number;
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
    verticalId?: number;
    bounds?: FacilityMapBounds;
  }): Promise<MapFacilityPointsGeoJson> {
    if (input.bounds && input.bounds.south >= input.bounds.north) {
      throw new ValidationError([
        { field: "bounds", message: "south must be less than north" },
      ]);
    }
    const listScope = buildFacilityListScope({
      scope: input.scope,
      role: input.role,
      verticalId: input.verticalId,
    });

    const points = await this.deps.facilityRepository.listMapPoints(
      listScope,
      input.bounds,
    );

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
