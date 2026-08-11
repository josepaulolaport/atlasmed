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
  BoundaryImpactSetChangedError,
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";
import { assertManagerReadableTerritory } from "./territory-crud.use-cases";
import { assertTerritorialJurisdiction } from "../services/territory-scope-policy.service";
import type { AmbiguousManagerZoneMatch } from "../services/territory-membership.service";
import { logger } from "../../../../infrastructure/logging/logger";

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
  /**
   * Clinics whose derived manager zone the save actually changed, published
   * after commit so downstream projections (the search index) can catch up.
   * Empty sets are not published.
   */
  onMembershipRecomputed?: (facilityIds: number[]) => Promise<void>;
}

export type BoundaryImpactClinic = {
  facilityId: number;
  facilityName: string;
  facilityVerticalProfileId: number;
  consultantUserId: number;
  consultantName: string;
};

/**
 * Spec 0006: the accepted set must equal the recomputed impact set exactly, in
 * both directions — the client is not trusted, and a boundary saved against a
 * stale preview fails closed.
 *
 * Spec 0009 R6: it fails with the **delta**. The previous version threw a bare
 * `ValidationError` saying the sets did not match, which left the caller unable
 * to tell a client bug from a concurrent edit, and with nothing to re-prompt on
 * but a full re-preview.
 */
export function assertAcceptedImpactFacilityIds(
  impactedFacilityIds: number[],
  acceptedFacilityIds: number[] | undefined
): void {
  const impacted = new Set(impactedFacilityIds);
  const accepted = new Set(acceptedFacilityIds ?? []);

  const ascending = (a: number, b: number) => a - b;
  // Impacted but not accepted: the caller has not agreed to these
  // de-assignments — either it never saw them, or they appeared since.
  const added = [...impacted].filter((id) => !accepted.has(id)).sort(ascending);
  // Accepted but no longer impacted: agreeing to a de-assignment that would not
  // happen is just as much a stale preview, and silently ignoring it would let
  // the client believe it acted on a set the server never had.
  const removed = [...accepted].filter((id) => !impacted.has(id)).sort(ascending);

  if (added.length === 0 && removed.length === 0) {
    return;
  }

  throw new BoundaryImpactSetChangedError({ added, removed });
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
    const { resolution, plan, ambiguous, changedFacilityIds } =
      await this.deps.transactionPort.run(async (tx) => {
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

      // Spec 0009 R6. Derived membership is recomputed here, after the geometry
      // is written and inside the same transaction, so the two commit together.
      // It used to be enqueued after commit, which meant HTTP 200 did not imply
      // membership was updated, and a failed job left the zone and its clinics
      // permanently disagreeing with nothing to say so.
      //
      // Only for manager zones: patch geometry does not decide zone membership.
      let ambiguous: AmbiguousManagerZoneMatch[] = [];
      let changedFacilityIds: number[] = [];
      if (mode === "manager_zone") {
        const recompute = await tx.membershipWriter.recomputeManagerZoneMembership(
          territory.id
        );
        ambiguous = recompute.ambiguous;
        changedFacilityIds = [...new Set(recompute.changed.map((c) => c.facilityId))];
      }

      return {
        resolution: resolveBoundaryOutcome(plan, result),
        plan,
        ambiguous,
        changedFacilityIds,
      };
    });

    // Spec 0009 R4 wants this loud. The full treatment — metric and a distinct
    // `ambiguous_zone` reason in the unassigned queue — belongs to P5-3; leaving
    // it entirely unreported in the meantime, when the recompute has just handed
    // it to us, would be manufacturing the silence that requirement is about.
    for (const match of ambiguous) {
      logger.warn("Clinic covered by more than one manager zone; membership cleared", {
        facilityId: match.facilityId,
        facilityVerticalProfileId: match.facilityVerticalProfileId,
        verticalId: match.verticalId,
        zoneIds: match.zoneIds.join(","),
        territoryId: input.territoryId,
      });
    }

    // Published only after commit, so no downstream job reads uncommitted rows
    // or reacts to a change that rolled back.
    if (changedFacilityIds.length > 0) {
      await this.deps.onMembershipRecomputed?.(changedFacilityIds);
    }

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
