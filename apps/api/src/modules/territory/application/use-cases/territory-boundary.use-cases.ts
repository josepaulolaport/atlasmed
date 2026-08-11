import type { ScopeContext } from "@atlasmed/access";
import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryContainmentService } from "../services/territory-containment.service";
import {
  planTerritoryBoundary,
  resolveBoundaryOutcome,
  toBoundaryCommitCommand,
} from "../services/territory-boundary.application";
import type { TerritoryTransactionPort } from "../interfaces/territory-transaction.port.interface";
import type { TerritoryBoundaryWriter } from "../interfaces/territory-boundary.writer.interface";
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
  /**
   * Spec 0009 R1: opens the transaction that spans validation, the impact
   * recompute and the boundary write.
   */
  transactionPort: TerritoryTransactionPort;
  /**
   * Rebuilds the containment service against transaction-bound repositories, so
   * containment and overlap are checked under the same snapshot that mutates.
   */
  buildContainmentService: (repos: {
    territoryRepository: TerritoryRepository;
    territoryTypeRepository: TerritoryTypeRepository;
    spatialRepository: TerritorySpatialRepository;
  }) => TerritoryContainmentService;
  onBoundaryChanged?: (territoryId: number) => Promise<void>;
  onManagerTerritoryChanged?: (managerTerritoryId: number) => Promise<void>;
}

export type BoundaryImpactClinic = {
  facilityId: number;
  facilityName: string;
  facilityVerticalProfileId: number;
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
    // Authorization reads the pool: it is about the caller, not the row, and
    // nothing it decides can be invalidated by a concurrent boundary save.
    await this.assertWritableBoundary(input.territoryId, input.scope);

    // Spec 0009 R1. Everything that can reject the save, and the mutation
    // itself, run under one transaction and one snapshot.
    //
    // The transaction opens before the first *read*, not before the first
    // write. Validating through the pool and mutating in a separate transaction
    // still lets a concurrent save land in between, so the boundary that
    // commits is not the one that was checked — the de-assignments would roll
    // back correctly while the geometry that orphans a patch goes in anyway.
    const { resolution, plan } = await this.deps.transactionPort.run(async (tx) => {
      if (!(await tx.lockTerritory(input.territoryId))) {
        throw new ResourceNotFoundError("Territory", input.territoryId);
      }

      // Re-read under the lock: the row may have moved since the scope check.
      const territory = await tx.territoryRepository.findById(input.territoryId);
      if (!territory) {
        throw new ResourceNotFoundError("Territory", input.territoryId);
      }

      const boundaryDeps = {
        territoryRepository: tx.territoryRepository,
        territoryTypeRepository: tx.territoryTypeRepository,
        spatialRepository: tx.spatialRepository,
        containmentService: this.deps.buildContainmentService({
          territoryRepository: tx.territoryRepository,
          territoryTypeRepository: tx.territoryTypeRepository,
          spatialRepository: tx.spatialRepository,
        }),
      };

      // Geometry → containment → sibling overlap. Every rejection throws here,
      // before a single rep assignment has been touched (I5: rows are never
      // deleted, so a de-assignment that should not have happened cannot be
      // undone by re-creating it).
      const plan = await planTerritoryBoundary(boundaryDeps, territory, input.geoJson);

      const mode = await this.resolveImpactMode(territory, tx.territoryTypeRepository);

      let impactedProfileIds: number[] = [];
      if (mode) {
        // The client is not trusted: recompute the impact set inside the same
        // snapshot and require the accepted set to match it exactly.
        const clinics = await tx.spatialRepository.findAssignedClinicsImpactedByBoundary({
          territoryId: input.territoryId,
          mode,
          geoJson: input.geoJson,
        });

        const impactedIds = clinics.map((c) => c.facilityId);
        assertAcceptedImpactFacilityIds(impactedIds, input.acceptedFacilityIds);

        impactedProfileIds = [
          ...new Set(clinics.map((c) => c.facilityVerticalProfileId)),
        ];
      }

      // Destructive step last, and only now.
      const result = await tx.boundaryWriter.commitBoundaryChange(
        toBoundaryCommitCommand(territory.id, plan, {
          endForProfileIds: impactedProfileIds,
          endReason: "boundary_impact",
        })
      );

      return { resolution: resolveBoundaryOutcome(plan, result), plan };
    });

    // Published only after commit, so no downstream job reads uncommitted rows
    // or reacts to a change that rolled back.
    if (plan.mode === "rep_patch") {
      await this.deps.onBoundaryChanged?.(input.territoryId);
      await this.deps.onManagerTerritoryChanged?.(plan.managerTerritoryId);
    } else if (plan.mode === "manager_zone") {
      await this.deps.onBoundaryChanged?.(input.territoryId);
    }

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
    territory: Awaited<ReturnType<TerritoryRepository["findById"]>>,
    typeRepository: TerritoryTypeRepository = this.deps.territoryTypeRepository
  ): Promise<"manager_zone" | "rep_patch" | null> {
    if (!territory) return null;

    const type =
      territory.territoryType ?? (await typeRepository.findById(territory.territoryTypeId));
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
