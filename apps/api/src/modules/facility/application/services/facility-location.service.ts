import type { AddressParts, FacilityGeocodingService } from "./facility-geocoding.service";
import type { AssignmentLosingCoverage } from "../../../territory/application/interfaces/territory-spatial.repository.interface";

/**
 * The one place a clinic's position is decided and written.
 *
 * Spec 0009 R5. Four code paths wrote `facilities.location`; three recomputed
 * membership and none checked existing rep assignments, so moving a clinic could
 * silently strand its rep outside their patch. Nothing else may write it —
 * including scripts.
 *
 * Two views of one fact (§decision 4): an address and a pin are never edited
 * independently. Supply an address and it is forward-geocoded; supply a pin and
 * it is reverse-geocoded. Explicit coordinates always win, so a Mapbox outage
 * cannot block a move outright.
 */

export interface FacilityLocationRepository {
  /** Current position, or nulls when the clinic has never been located. */
  findLocation(facilityId: number): Promise<{ lat: number | null; lng: number | null } | null>;
  /** The only write. */
  saveLocation(input: { facilityId: number; lat: number; lng: number }): Promise<void>;
}

export interface CoverageDelta {
  /** Assignments a move would invalidate. Empty means nothing to warn about. */
  losingCoverage: AssignmentLosingCoverage[];
}

export interface ResolvedFacilityLocation {
  lat: number;
  lng: number;
  /** The address the coordinates resolve to, when reverse geocoding succeeded. */
  resolvedAddress: string | null;
  /** True when coordinates were derived from an address rather than supplied. */
  geocoded: boolean;
}

interface Dependencies {
  locationRepository: FacilityLocationRepository;
  geocodingService: FacilityGeocodingService;
  coverage: {
    findAssignmentsLosingPatchCoverage(input: {
      facilityId: number;
      lat: number;
      lng: number;
    }): Promise<AssignmentLosingCoverage[]>;
  };
  /** Derived manager-zone membership follows the new position. */
  onLocationChanged: (facilityId: number) => Promise<void>;
}

export class FacilityLocationError extends Error {
  constructor(
    message: string,
    readonly reason: "unresolvable" | "coverage_not_accepted"
  ) {
    super(message);
    this.name = "FacilityLocationError";
  }
}

export class FacilityLocationService {
  constructor(private readonly deps: Dependencies) {}

  /**
   * Turn whatever the caller supplied into a point, without writing anything.
   * Explicit coordinates bypass geocoding entirely (R5): a Mapbox outage must
   * not stop someone correcting a pin they can see is wrong.
   */
  async resolve(input: {
    lat?: number | null;
    lng?: number | null;
    address?: AddressParts | null;
  }): Promise<ResolvedFacilityLocation> {
    if (input.lat != null && input.lng != null) {
      return {
        lat: input.lat,
        lng: input.lng,
        // A pin move is the edit most able to strand a rep, so the address is
        // brought along rather than left describing the old position.
        resolvedAddress: await this.reverseGeocode(input.lat, input.lng),
        geocoded: false,
      };
    }

    if (input.address) {
      const geocoded = await this.deps.geocodingService.resolveCoordinates({
        address: input.address,
      });
      if (geocoded.lat != null && geocoded.lng != null) {
        return {
          lat: geocoded.lat,
          lng: geocoded.lng,
          resolvedAddress: null,
          geocoded: true,
        };
      }
    }

    throw new FacilityLocationError(
      "Could not resolve a position from the address, and no coordinates were supplied",
      "unresolvable"
    );
  }

  /**
   * What a proposed move would break. Empty delta means the change proceeds with
   * no prompt (R5) — warning merely because someone is assigned is the alert
   * fatigue the requirement exists to avoid.
   */
  async previewCoverageDelta(input: {
    facilityId: number;
    lat: number;
    lng: number;
  }): Promise<CoverageDelta> {
    return {
      losingCoverage: await this.deps.coverage.findAssignmentsLosingPatchCoverage(input),
    };
  }

  /**
   * Resolve, check, write, recompute — the whole move, in one call.
   *
   * `acceptCoverageLoss` is the human confirmation: without it a move that would
   * strand a rep is refused. §1.1 — a machine may not destroy an assertion, and
   * moving a clinic out of its rep's patch is destroying one by side effect.
   */
  async applyLocation(input: {
    facilityId: number;
    lat?: number | null;
    lng?: number | null;
    address?: AddressParts | null;
    acceptCoverageLoss?: boolean;
  }): Promise<ResolvedFacilityLocation & CoverageDelta> {
    const resolved = await this.resolve(input);

    const delta = await this.previewCoverageDelta({
      facilityId: input.facilityId,
      lat: resolved.lat,
      lng: resolved.lng,
    });

    if (delta.losingCoverage.length > 0 && !input.acceptCoverageLoss) {
      throw new FacilityLocationError(
        `Moving this clinic leaves ${delta.losingCoverage.length} rep assignment(s) outside their patch`,
        "coverage_not_accepted"
      );
    }

    await this.deps.locationRepository.saveLocation({
      facilityId: input.facilityId,
      lat: resolved.lat,
      lng: resolved.lng,
    });

    // Membership is derived from the point, so it is recomputed here rather than
    // left to whichever caller remembers — the omission that made
    // `geocode-facilities.ts` write locations nothing ever reacted to (D-18).
    await this.deps.onLocationChanged(input.facilityId);

    return { ...resolved, ...delta };
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      return await this.deps.geocodingService.describePoint({ lat, lng });
    } catch {
      // The pin is authoritative; a failed lookup must not block the move. The
      // address simply stays as it was rather than being wrongly overwritten.
      return null;
    }
  }
}
