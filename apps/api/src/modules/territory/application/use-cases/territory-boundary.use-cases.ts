import type { ScopeContext } from "@atlasmed/access";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "../services/territory-containment.service";
import type { FacilityConsultantAssignmentRepository } from "../../../facility/application/interfaces/facility-consultant-assignment.repository.interface";
import { applyTerritoryBoundary } from "../services/territory-boundary.application";
import { serializeBoundaryResolution } from "../utils/territory-boundary-resolution.utils";
import {
  MANAGER_ZONE_TYPE_SLUG,
  REP_PATCH_TYPE_SLUG,
  isManagerZoneType,
  isRepPatchType,
} from "../constants/territory-roles.constants";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import { assertManagerReadableTerritory } from "./territory-crud.use-cases";
import { assertTerritorialJurisdiction } from "../services/territory-scope-policy.service";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  spatialRepository: TerritorySpatialRepository;
  containmentService: TerritoryContainmentService;
  consultantAssignmentRepository: FacilityConsultantAssignmentRepository;
  onBoundaryChanged?: (territoryId: number) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: number) => Promise<void>;
}

export type BoundaryImpactClinic = {
  facilityId: number;
  facilityName: string;
  consultantUserId: number;
  consultantName: string;
};

/** Spec 0006: accepted set must equal impact set exactly. */
export function assertAcceptedImpactFacilityIds(
  impactedFacilityIds: number[],
  acceptedFacilityIds: number[] | undefined
): void {
  if (impactedFacilityIds.length === 0) {
    if (acceptedFacilityIds && acceptedFacilityIds.length > 0) {
      throw new ValidationError([
        {
          field: "acceptedFacilityIds",
          message: "No clinics require deassignment for this boundary change",
        },
      ]);
    }
    return;
  }

  if (!acceptedFacilityIds || acceptedFacilityIds.length === 0) {
    throw new ValidationError([
      {
        field: "acceptedFacilityIds",
        message:
          "Accept deassignment for every impacted clinic before saving the boundary",
      },
    ]);
  }

  const impacted = new Set(impactedFacilityIds);
  const accepted = new Set(acceptedFacilityIds);

  if (impacted.size !== accepted.size) {
    throw new ValidationError([
      {
        field: "acceptedFacilityIds",
        message: "Accepted clinics must match the full impact list exactly",
      },
    ]);
  }

  for (const id of impacted) {
    if (!accepted.has(id)) {
      throw new ValidationError([
        {
          field: "acceptedFacilityIds",
          message: "Accepted clinics must match the full impact list exactly",
        },
      ]);
    }
  }
}

export class TerritoryBoundaryUseCases {
  constructor(private readonly deps: Dependencies) {}

  async getBoundary(input: { territoryId: number; scope: ScopeContext }) {
    await this.assertReadable(input.territoryId, input.scope);

    const boundary = await this.deps.spatialRepository.getBoundaryAsGeoJson(
      input.territoryId
    );

    if (!boundary) {
      return null;
    }

    return boundary;
  }

  async previewBoundaryImpact(input: {
    territoryId: number;
    scope: ScopeContext;
    geoJson: GeoJsonGeometry;
  }) {
    const territory = await this.assertWritableBoundary(input.territoryId, input.scope);
    const mode = await this.resolveImpactMode(territory);

    if (!mode) {
      return { mode: "other" as const, clinics: [] as BoundaryImpactClinic[] };
    }

    const clinics =
      await this.deps.spatialRepository.findAssignedClinicsImpactedByBoundary({
        territoryId: input.territoryId,
        mode,
        geoJson: input.geoJson,
      });

    return { mode, clinics };
  }

  async saveBoundary(input: {
    territoryId: number;
    scope: ScopeContext;
    geoJson: GeoJsonGeometry;
    acceptedFacilityIds?: number[];
  }) {
    const territory = await this.assertWritableBoundary(input.territoryId, input.scope);
    const mode = await this.resolveImpactMode(territory);

    if (mode) {
      const clinics =
        await this.deps.spatialRepository.findAssignedClinicsImpactedByBoundary({
          territoryId: input.territoryId,
          mode,
          geoJson: input.geoJson,
        });

      const impactedIds = clinics.map((c) => c.facilityId);
      assertAcceptedImpactFacilityIds(impactedIds, input.acceptedFacilityIds);

      if (impactedIds.length > 0) {
        await this.deps.consultantAssignmentRepository.endActiveForFacilities({
          facilityIds: impactedIds,
          endReason: "boundary_impact",
        });
      }
    }

    const resolution = await applyTerritoryBoundary(
      {
        territoryRepository: this.deps.territoryRepository,
        territoryTypeRepository: this.deps.territoryTypeRepository,
        spatialRepository: this.deps.spatialRepository,
        containmentService: this.deps.containmentService,
        onBoundaryChanged: this.deps.onBoundaryChanged,
        onManagerTerritoryChanged: this.deps.onManagerTerritoryChanged,
      },
      territory,
      input.geoJson
    );

    return serializeBoundaryResolution(resolution);
  }

  async deleteBoundary(input: { territoryId: number; scope: ScopeContext }) {
    const territory = await this.assertWritableBoundary(input.territoryId, input.scope);

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (type?.canHaveBoundary) {
      throw new OperationNotAllowedError(
        "delete_boundary",
        "Territories of this type must keep a geographic boundary"
      );
    }

    await this.deps.spatialRepository.deleteBoundary(input.territoryId);

    if (type && isRepPatchType(type)) {
      await this.deps.onBoundaryChanged?.(input.territoryId);
    }

    return { success: true };
  }

  private async resolveImpactMode(
    territory: Awaited<ReturnType<TerritoryRepository["findById"]>>
  ): Promise<"manager_zone" | "rep_patch" | null> {
    if (!territory) return null;

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!type) return null;

    if (type.slug === MANAGER_ZONE_TYPE_SLUG) return "manager_zone";
    if (type.slug === REP_PATCH_TYPE_SLUG) return "rep_patch";
    return null;
  }

  private async assertReadable(territoryId: number, scope: ScopeContext): Promise<void> {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    assertManagerReadableTerritory(scope, territoryId);
  }

  private async assertWritableBoundary(territoryId: number, scope: ScopeContext) {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    if (!territory.isActive) {
      throw new OperationNotAllowedError("save_boundary", "Territory is not active");
    }

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!type || !type.canHaveBoundary) {
      throw new OperationNotAllowedError(
        "save_boundary",
        "This territory type cannot have a boundary"
      );
    }

    assertTerritorialJurisdiction(scope, territoryId, "save_boundary");

    // Spec 0006: only ADMIN (global scope) edits manager zone geometry.
    if (!scope.isGlobal && type && isManagerZoneType(type)) {
      throw new OperationNotAllowedError(
        "save_boundary",
        "Only admins can edit manager zone boundaries"
      );
    }

    return territory;
  }
}
