import { describe, expect, it, mock } from "bun:test";
import {
  FacilityLocationError,
  FacilityLocationService,
} from "./facility-location.service";
import type { AssignmentLosingCoverage } from "../../../territory/application/interfaces/territory-spatial.repository.interface";

const FACILITY_ID = 7;

const STRANDED: AssignmentLosingCoverage = {
  facilityVerticalProfileId: 70,
  verticalId: 1,
  userId: 9,
  userName: "Rep A",
};

function build(options: {
  losingCoverage?: AssignmentLosingCoverage[];
  geocodeTo?: { lat: number; lng: number } | null;
  describePointTo?: string | null;
  describePointThrows?: boolean;
} = {}) {
  const saveLocation = mock(async (_input: unknown) => {});
  const onLocationChanged = mock(async (_id: number) => {});
  const geocodeCalled = mock(async (_input: unknown) => ({
    lat: options.geocodeTo?.lat ?? null,
    lng: options.geocodeTo?.lng ?? null,
    geocoded: options.geocodeTo != null,
  }));
  const describePoint = mock(async (_input: unknown) => {
    if (options.describePointThrows) throw new Error("mapbox down");
    return options.describePointTo ?? null;
  });

  const service = new FacilityLocationService({
    locationRepository: {
      findLocation: mock(async () => ({ lat: 0, lng: 0 })),
      saveLocation,
    },
    geocodingService: {
      resolveCoordinates: geocodeCalled,
      describePoint,
    } as never,
    coverage: {
      findAssignmentsLosingPatchCoverage: mock(
        async () => options.losingCoverage ?? []
      ),
    },
    onLocationChanged,
  });

  return { service, saveLocation, onLocationChanged, geocodeCalled, describePoint };
}

describe("FacilityLocationService", () => {
  /**
   * R5: "Explicit coordinates bypass geocoding (so a Mapbox outage cannot block
   * address edits entirely)."
   */
  it("uses supplied coordinates without forward geocoding", async () => {
    const { service, geocodeCalled } = build({ describePointTo: "Rua A, 1" });

    const resolved = await service.resolve({ lat: -23.5, lng: -46.6 });

    expect(resolved).toMatchObject({ lat: -23.5, lng: -46.6, geocoded: false });
    expect(geocodeCalled).not.toHaveBeenCalled();
    // Decision 4: the pin moved, so the address follows it.
    expect(resolved.resolvedAddress).toBe("Rua A, 1");
  });

  it("a failed reverse geocode does not block the move", async () => {
    const { service } = build({ describePointThrows: true });

    const resolved = await service.resolve({ lat: 1, lng: 2 });

    // The pin is authoritative; the address simply stays as it was rather than
    // being wrongly overwritten.
    expect(resolved).toMatchObject({ lat: 1, lng: 2, resolvedAddress: null });
  });

  it("geocodes when only an address is supplied", async () => {
    const { service, geocodeCalled } = build({ geocodeTo: { lat: 10, lng: 20 } });

    const resolved = await service.resolve({ address: { city: "Sao Paulo", state: "SP" } });

    expect(resolved).toMatchObject({ lat: 10, lng: 20, geocoded: true });
    expect(geocodeCalled).toHaveBeenCalled();
  });

  it("refuses when neither coordinates nor a geocodable address are given", async () => {
    const { service } = build({ geocodeTo: null });

    await expect(
      service.resolve({ address: { city: "Nowhere" } })
    ).rejects.toBeInstanceOf(FacilityLocationError);
  });

  /**
   * R5: "Empty delta ⇒ the change proceeds with no prompt." Requiring
   * confirmation for a move that breaks nothing is the alert fatigue the
   * requirement exists to avoid.
   */
  it("applies a harmless move with no confirmation, and recomputes membership", async () => {
    const { service, saveLocation, onLocationChanged } = build({ losingCoverage: [] });

    const result = await service.applyLocation({
      facilityId: FACILITY_ID,
      lat: -23.5,
      lng: -46.6,
    });

    expect(result.losingCoverage).toEqual([]);
    expect(saveLocation).toHaveBeenCalledWith({
      facilityId: FACILITY_ID,
      lat: -23.5,
      lng: -46.6,
    });
    expect(onLocationChanged).toHaveBeenCalledWith(FACILITY_ID);
  });

  /**
   * §1.1: moving a clinic out of its rep's patch destroys a human assertion by
   * side effect, so it needs a human to say so.
   */
  it("refuses a move that strands a rep, and writes nothing", async () => {
    const { service, saveLocation, onLocationChanged } = build({
      losingCoverage: [STRANDED],
    });

    await expect(
      service.applyLocation({ facilityId: FACILITY_ID, lat: 40, lng: 40 })
    ).rejects.toMatchObject({ reason: "coverage_not_accepted" });

    expect(saveLocation).not.toHaveBeenCalled();
    expect(onLocationChanged).not.toHaveBeenCalled();
  });

  it("proceeds once the coverage loss is accepted, and reports who was affected", async () => {
    const { service, saveLocation } = build({ losingCoverage: [STRANDED] });

    const result = await service.applyLocation({
      facilityId: FACILITY_ID,
      lat: 40,
      lng: 40,
      acceptCoverageLoss: true,
    });

    expect(saveLocation).toHaveBeenCalled();
    // The caller is told exactly which assignment it just invalidated.
    expect(result.losingCoverage).toEqual([STRANDED]);
  });
});
