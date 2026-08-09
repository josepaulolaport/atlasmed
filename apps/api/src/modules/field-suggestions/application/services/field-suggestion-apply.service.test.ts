import { describe, expect, it, mock } from "bun:test";
import { FieldSuggestionApplyService } from "./field-suggestion-apply.service";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { FacilityGeocodingService } from "../../../facility/application/services/facility-geocoding.service";
import {
  OperationNotAllowedError,
  ValidationError,
} from "../../../../shared/errors";

describe("FieldSuggestionApplyService", () => {
  const facilityRepository = {
    applyApprovedFieldUpdates: mock(async () => ({ id: 1 })),
  } as unknown as FacilityRepository;

  const facilityGeocodingService = {
    geocodeAddress: mock(async () => ({ lat: -23.55, lng: -46.63 })),
  } as unknown as FacilityGeocodingService;

  const onFacilityLocationChanged = mock(async () => undefined);

  const service = new FieldSuggestionApplyService({
    facilityRepository,
    facilityGeocodingService,
    onFacilityLocationChanged,
  });

  it("applies phone without geocoding", async () => {
    const result = await service.applyFieldChange({
      facilityId: 1,
      fieldKey: "phoneNumber",
      proposedValue: "11999990000",
    });

    expect(result).toEqual({ geocoded: false });
    expect(facilityGeocodingService.geocodeAddress).not.toHaveBeenCalled();
    expect(facilityRepository.applyApprovedFieldUpdates).toHaveBeenCalled();
  });

  it("geocodes and updates location for address", async () => {
    (facilityRepository.applyApprovedFieldUpdates as ReturnType<typeof mock>).mockClear();
    (facilityGeocodingService.geocodeAddress as ReturnType<typeof mock>).mockClear();
    onFacilityLocationChanged.mockClear();

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
    expect(facilityGeocodingService.geocodeAddress).toHaveBeenCalled();
    expect(onFacilityLocationChanged).toHaveBeenCalledWith(1);
    expect(facilityRepository.applyApprovedFieldUpdates).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        streetAddress: "Av. Paulista",
        lat: -23.55,
        lng: -46.63,
      })
    );
  });

  it("fails when geocode returns null", async () => {
    (facilityGeocodingService.geocodeAddress as ReturnType<typeof mock>).mockResolvedValueOnce(
      null
    );

    await expect(
      service.applyFieldChange({
        facilityId: 1,
        fieldKey: "address",
        proposedValue: { streetAddress: "Rua X", city: "São Paulo" },
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
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
