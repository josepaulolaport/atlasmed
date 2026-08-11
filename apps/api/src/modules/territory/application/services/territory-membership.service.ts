import type {
  ClinicAssignmentTerritoryMatch,
  TerritorySpatialRepository,
} from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";

export interface ClinicMembershipTarget {
  id: number;
  lat: number | null;
  lng: number | null;
  managerZoneId: number | null;
}

/** One profile whose derived manager zone changed. */
export interface ManagerZoneMembershipChange {
  facilityVerticalProfileId: number;
  facilityId: number;
  managerZoneId: number | null;
}

/**
 * A profile covered by more than one same-vertical manager zone. Its membership
 * is set to NULL because no single owner can be derived — spec 0009 R4 requires
 * this to be loud rather than a silent disappearance from both zones.
 */
export interface AmbiguousManagerZoneMatch {
  facilityVerticalProfileId: number;
  facilityId: number;
  verticalId: number;
  zoneIds: number[];
}

export interface ManagerZoneMembershipRecompute {
  changed: ManagerZoneMembershipChange[];
  ambiguous: AmbiguousManagerZoneMatch[];
}

export interface ClinicMembershipWriter {
  updateProfileTerritoryMemberships(
    facilityId: number,
    memberships: Array<{ verticalId: number; managerZoneId: number | null }>
  ): Promise<void>;

  /**
   * Recomputes derived manager-zone membership for every profile a territory's
   * boundary can affect, in one statement.
   *
   * Spec 0009 R6. The per-clinic loop this replaces cost two round-trips per
   * clinic — ~2500 for a national recompute — which is why the work was pushed
   * onto a queue and HTTP 200 stopped meaning "membership is updated". Set-based
   * it measures ~21 ms against the production snapshot, so it can run inside the
   * boundary transaction: geometry and the membership it implies now commit
   * together or not at all.
   */
  recomputeManagerZoneMembership(
    territoryId: number
  ): Promise<ManagerZoneMembershipRecompute>;


  findClinicsForMembership(params?: {
    facilityIds?: number[];
    territoryIds?: number[];
    boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  }): Promise<ClinicMembershipTarget[]>;

  /**
   * Spec 0006: clinics in manager zones with no active primary consultant.
   * When managerZoneIds is omitted/empty and global is true, all zones.
   */
  findClinicsWithoutConsultant(params: {
    managerZoneIds?: number[];
    global: boolean;
  }): Promise<
    Array<{
      id: number;
      displayName: string;
      lat: number | null;
      lng: number | null;
      managerZoneId: number;
      managerZoneName: string | null;
    }>
  >;
}

interface Dependencies {
  spatialRepository: TerritorySpatialRepository;
  territoryRepository: TerritoryRepository;
  clinicWriter: ClinicMembershipWriter;
  /** Keep Meili `territoryIds` in sync after zone membership writes. */
  onClinicMembershipChanged?: (facilityId: number) => Promise<void>;
  /**
   * Spec 0009 R4 reporting. Injected rather than imported so this service stays
   * free of the metrics and logging singletons, as the rest of the application
   * layer here is.
   */
  recordAmbiguousMatch?: (source: "clinic_recompute", count: number) => void;
  logAmbiguousMatch?: (match: {
    facilityId: number;
    verticalId: number;
    zoneIds: number[];
  }) => void;
}

export class TerritoryMembershipService {
  constructor(private readonly deps: Dependencies) {}

  async assignClinicByGeo(
    clinic: ClinicMembershipTarget,
    options?: {
      excludeTerritoryId?: number;
      force?: boolean;
      /**
       * When false, skip Meili upsert (bulk recompute / boundary jobs).
       * Single-clinic paths keep default true. Follow bulk with Temporal
       * facilities search sync if Meili territoryIds must catch up immediately.
       */
      notifySearch?: boolean;
    }
  ): Promise<void> {
    const notifySearch = options?.notifySearch !== false;

    if (clinic.lat === null || clinic.lng === null) {
      await this.deps.clinicWriter.updateProfileTerritoryMemberships(clinic.id, []);
      if (notifySearch) {
        await this.deps.onClinicMembershipChanged?.(clinic.id);
      }
      return;
    }

    const matches = await this.deps.spatialRepository.findContainingClinicAssignmentTerritoryIds(
      clinic.lng,
      clinic.lat,
      { excludeTerritoryId: options?.excludeTerritoryId }
    );

    const { singleMatches, ambiguousMatches } = this.resolveVerticalMatches(matches);

    // Spec 0009 R4. Until now `hasAmbiguousMatch` was computed and had no
    // consumer at all: a clinic covered by two same-vertical zones vanished from
    // both managers' views with nothing recorded anywhere. Membership still
    // clears — no single owner can be derived — but it no longer does so quietly.
    if (ambiguousMatches.length > 0) {
      this.deps.recordAmbiguousMatch?.("clinic_recompute", ambiguousMatches.length);
      for (const ambiguous of ambiguousMatches) {
        this.deps.logAmbiguousMatch?.({
          facilityId: clinic.id,
          verticalId: ambiguous.verticalId,
          zoneIds: ambiguous.zoneIds,
        });
      }
    }

    await this.deps.clinicWriter.updateProfileTerritoryMemberships(
      clinic.id,
      singleMatches.map((match) => ({
        verticalId: match.verticalId,
        managerZoneId: match.id,
      }))
    );
    if (notifySearch) {
      await this.deps.onClinicMembershipChanged?.(clinic.id);
    }
  }

  /**
   * Clears clinic membership for a territory that is about to be deleted.
   * Re-runs geo matching excluding this territory so clinics land on whatever
   * other active territory covers them (or become unassigned) instead of
   * blocking deletion.
   */
  async disassociateClinicsForTerritory(territoryId: number): Promise<{ processed: number }> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership({
      territoryIds: [territoryId],
    });

    for (const clinic of clinics) {
      await this.assignClinicByGeo(clinic, {
        excludeTerritoryId: territoryId,
        force: true,
        notifySearch: false,
      });
    }

    return { processed: clinics.length };
  }

  async assignFacilityById(facilityId: number): Promise<void> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership({
      facilityIds: [facilityId],
    });
    const clinic = clinics[0];
    if (!clinic) {
      return;
    }
    await this.assignClinicByGeo(clinic);
  }

  async recomputeAll(): Promise<{ processed: number; updated: number }> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership();
    let updated = 0;

    for (const clinic of clinics) {
      const before = clinic.managerZoneId;
      // Bulk path: no per-clinic Meili round-trip (HTTP timeout risk).
      await this.assignClinicByGeo(clinic, { notifySearch: false });
      const after = (
        await this.deps.clinicWriter.findClinicsForMembership({
          facilityIds: [clinic.id],
        })
      )[0]?.managerZoneId;
      if (before !== after) {
        updated += 1;
      }
    }

    return { processed: clinics.length, updated };
  }

  /**
   * Delegates to the one set-based statement so the queued path and the
   * transactional path in `saveBoundary` apply the same rule. Two
   * implementations of "which zone owns this clinic" would drift.
   */
  async recomputeForTerritoryBoundary(
    territoryId: number
  ): Promise<ManagerZoneMembershipRecompute> {
    // Deliberately does not touch the search index, matching the loop it
    // replaces (which passed `notifySearch: false`): Meili's `territoryIds`
    // catch up on the periodic rebuild, not here. Syncing inline would put N
    // HTTP calls to an external service on this path.
    return this.deps.clinicWriter.recomputeManagerZoneMembership(territoryId);
  }

  /**
   * Exactly one covering zone per vertical wins; zero or several resolve to no
   * membership. Returns *which* verticals were ambiguous and which zones
   * competed — the previous `hasAmbiguousMatch: boolean` could not say either,
   * which is part of why nothing consumed it.
   */
  private resolveVerticalMatches(matches: ClinicAssignmentTerritoryMatch[]): {
    singleMatches: ClinicAssignmentTerritoryMatch[];
    ambiguousMatches: Array<{ verticalId: number; zoneIds: number[] }>;
  } {
    const matchesByVerticalId = new Map<number, ClinicAssignmentTerritoryMatch[]>();
    for (const match of matches) {
      const verticalMatches = matchesByVerticalId.get(match.verticalId) ?? [];
      verticalMatches.push(match);
      matchesByVerticalId.set(match.verticalId, verticalMatches);
    }

    const singleMatches: ClinicAssignmentTerritoryMatch[] = [];
    const ambiguousMatches: Array<{ verticalId: number; zoneIds: number[] }> = [];
    for (const [verticalId, verticalMatches] of matchesByVerticalId) {
      if (verticalMatches.length === 1) {
        singleMatches.push(verticalMatches[0]!);
      } else {
        ambiguousMatches.push({
          verticalId,
          zoneIds: verticalMatches.map((match) => match.id),
        });
      }
    }

    return { singleMatches, ambiguousMatches };
  }
}
