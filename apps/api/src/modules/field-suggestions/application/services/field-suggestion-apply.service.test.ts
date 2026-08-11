import { describe, expect, it, mock } from "bun:test";
import { FieldSuggestionApplyService } from "./field-suggestion-apply.service";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { FacilityLocationService } from "../../../facility/application/services/facility-location.service";
import { ValidationError } from "../../../../shared/errors";

describe("FieldSuggestionApplyService", () => {
  const facilityRepository = {
    applyApprovedFieldUpdates: mock(async () => ({ id: 1 })),
  } as unknown as FacilityRepository;

  // Spec 0009 R5: this service no longer geocodes or writes coordinates. It
  // hands the change to the one owner of `facilities.location`, which resolves,
  // checks the coverage delta, writes, and recomputes membership.
  const applyLocation = mock(async (_input: unknown) => ({
    lat: -23.55,
    lng: -46.63,
    resolvedAddress: null,
    geocoded: true,
    losingCoverage: [],
  }));

  const service = new FieldSuggestionApplyService({
    facilityRepository,
    locationService: { applyLocation } as unknown as FacilityLocationService,
  });

  it("applies phone without geocoding", async () => {
    const result = await service.applyFieldChange({
      facilityId: 1,
      fieldKey: "phoneNumber",
      proposedValue: "11999990000",
    });

    expect(result).toEqual({ geocoded: false });
    expect(applyLocation).not.toHaveBeenCalled();
    expect(facilityRepository.applyApprovedFieldUpdates).toHaveBeenCalled();
  });

  it("routes an address change through the location service", async () => {
    (facilityRepository.applyApprovedFieldUpdates as ReturnType<typeof mock>).mockClear();
    applyLocation.mockClear();

    const result = await service.applyFieldChange({
      facilityId: 1,
      fieldKey: "address",
      proposedValue: {
        streetAddress: "Av. Paulista",
        streetNumber: "1000",
        city: "São Paulo",
        state: "SP",
      },
    });

    expect(result).toEqual({ geocoded: true });
    // The point is derived by the location service, not written here.
    expect(applyLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: 1,
        address: expect.objectContaining({ streetAddress: "Av. Paulista" }),
      })
    );
    // The address text is still applied as the suggestion's own payload — and
    // without lat/lng, which this service must no longer write.
    const updates = (facilityRepository.applyApprovedFieldUpdates as ReturnType<typeof mock>)
      .mock.calls[0]![1] as Record<string, unknown>;
    expect(updates).toMatchObject({ streetAddress: "Av. Paulista" });
    expect(updates.lat).toBeUndefined();
    expect(updates.lng).toBeUndefined();
  });

  /**
   * Spec 0009 R5 / decision 4: a pin move is reviewable like any other edit, and
   * the one most able to strand a rep.
   */
  it("routes a coordinate change through the location service", async () => {
    applyLocation.mockClear();

    const result = await service.applyFieldChange({
      facilityId: 1,
      fieldKey: "coordinates",
      proposedValue: { lat: -23.5, lng: -46.6 },
      acceptCoverageLoss: true,
    });

    expect(result).toEqual({ geocoded: false });
    expect(applyLocation).toHaveBeenCalledWith({
      facilityId: 1,
      lat: -23.5,
      lng: -46.6,
      acceptCoverageLoss: true,
    });
  });

  it("rejects coordinates outside the possible range", () => {
    expect(() =>
      service.validateProposedValue("coordinates", { lat: 91, lng: 0 })
    ).toThrow(ValidationError);
    expect(() =>
      service.validateProposedValue("coordinates", { lat: 0, lng: 181 })
    ).toThrow(ValidationError);
    expect(() =>
      service.validateProposedValue("coordinates", { lat: "x", lng: 0 })
    ).toThrow(ValidationError);
  });

  it("rejects empty string proposed values", () => {
    expect(() =>
      service.validateProposedValue("email", "   ")
    ).toThrow(ValidationError);
  });

  it("coerces digit-only jsonb numbers back to strings", () => {
    expect(service.validateProposedValue("phoneNumber", 11888887777)).toBe(
      "11888887777"
    );
  });
});
