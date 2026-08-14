import {
  OperationNotAllowedError,
  ValidationError,
} from "../../../../shared/errors";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { AddressParts } from "../../../facility/application/services/facility-geocoding.service";
import type { FacilityLocationService } from "../../../facility/application/services/facility-location.service";
import {
  normalizeLegalDocument,
  validateLegalDocument,
} from "../../../facility/application/utils/facility-tax-id.utils";
import type { FieldSuggestionFieldKey } from "../constants/field-keys";

function asNonEmptyString(value: unknown, field: string): string {
  // Digit-only strings round-trip through jsonb/postgres.js as numbers.
  if (typeof value === "number" && Number.isFinite(value)) {
    value = String(value);
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError([
      { field, message: "Value must be a non-empty string" },
    ]);
  }
  return value.trim();
}

function asOptionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new ValidationError([
      { field: "proposedValue", message: "Expected string or null" },
    ]);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAddress(value: unknown): AddressParts {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError([
      { field: "proposedValue", message: "Address must be an object" },
    ]);
  }

  const obj = value as Record<string, unknown>;
  return {
    neighborhood: asOptionalString(obj.neighborhood),
    streetAddress: asOptionalString(obj.streetAddress),
    streetNumber: asOptionalString(obj.streetNumber),
    addressComplement: asOptionalString(obj.addressComplement),
    city: asOptionalString(obj.city),
    state: asOptionalString(obj.state),
    postalCode: asOptionalString(obj.postalCode),
    country: asOptionalString(obj.country) ?? "Brazil",
  };
}

/**
 * A proposed pin, validated before it can ever reach the map. Out-of-range
 * values are rejected here rather than becoming a point somewhere impossible.
 */
function parseCoordinates(value: unknown): { lat: number; lng: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError([
      { field: "proposedValue", message: "Coordinates must be an object" },
    ]);
  }

  const obj = value as Record<string, unknown>;
  const lat = Number(obj.lat);
  const lng = Number(obj.lng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new ValidationError([
      { field: "proposedValue", message: "lat must be a number between -90 and 90" },
    ]);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ValidationError([
      { field: "proposedValue", message: "lng must be a number between -180 and 180" },
    ]);
  }

  return { lat, lng };
}

export class FieldSuggestionApplyService {
  constructor(
    private readonly deps: {
      facilityRepository: FacilityRepository;
      /**
       * Spec 0009 R5: the one owner of every location write. It geocodes,
       * computes the coverage delta, writes, and recomputes membership — none of
       * which this service should be doing itself.
       */
      locationService: FacilityLocationService;
    }
  ) {}

  validateProposedValue(fieldKey: FieldSuggestionFieldKey, proposedValue: unknown): unknown {
    switch (fieldKey) {
      case "displayName":
      case "phoneNumber":
      case "whatsappNumber":
      case "email":
      case "websiteUrl":
      case "responsibleName":
      case "openingHours":
        return asNonEmptyString(proposedValue, "proposedValue");
      case "legalDocument": {
        const value = asNonEmptyString(proposedValue, "proposedValue");

        /**
         * Checked here and not only on apply.
         *
         * `applyFieldChange` has always run the full módulo-11 check, but this
         * did not: any non-empty string was accepted. So `123` could be filed
         * as a CPF, sit in the review queue looking like work to do, and throw
         * in the *reviewer's* face at approval — the one person who cannot fix
         * it, and long after the rep who typed it has moved on.
         *
         * The type is inferred from digit length rather than read from the
         * facility, which keeps this synchronous and costs no extra query per
         * submission. It catches every malformed value. A well-formed CNPJ
         * proposed for a CPF clinic still passes here and is refused on apply,
         * where the facility's own type is known — a far rarer mistake than a
         * number that is not a document at all.
         */
        const result = validateLegalDocument({
          legalDocument: value,
          documentField: "proposedValue",
          typeField: "proposedValue",
        });
        if (!result.ok) {
          throw new ValidationError(result.issues);
        }

        // The rep's formatting is kept for the reviewer to read; `applyFieldChange`
        // normalizes to digits before it writes.
        return value;
      }
      case "legalDocumentType": {
        const value = asNonEmptyString(proposedValue, "proposedValue");
        if (value !== "CNPJ" && value !== "CPF") {
          throw new ValidationError([
            {
              field: "proposedValue",
              message: "legalDocumentType must be CNPJ or CPF",
            },
          ]);
        }
        return value;
      }
      case "address":
        return parseAddress(proposedValue);
      case "coordinates":
        return parseCoordinates(proposedValue);
    }
  }

  async applyFieldChange(input: {
    facilityId: number;
    fieldKey: FieldSuggestionFieldKey;
    proposedValue: unknown;
    /**
     * The reviewer has seen which reps the move would strand and accepts it.
     * Without this a stranding move is refused with the list (R5).
     */
    acceptCoverageLoss?: boolean;
  }): Promise<{ geocoded: boolean }> {
    const validated = this.validateProposedValue(input.fieldKey, input.proposedValue);

    // Spec 0009 R5: both location edits go through the choke point. This service
    // used to geocode and write lat/lng itself via applyApprovedFieldUpdates —
    // it was the fourth writer of `facilities.location`, and the one that could
    // move a clinic out of its rep's patch on an approval with nothing checked.
    if (input.fieldKey === "address") {
      const address = validated as AddressParts;

      await this.deps.locationService.applyLocation({
        facilityId: input.facilityId,
        address,
        acceptCoverageLoss: input.acceptCoverageLoss,
      });

      // The address text itself is still the suggestion's payload; the point is
      // derived from it by the location service.
      await this.deps.facilityRepository.applyApprovedFieldUpdates(
        input.facilityId,
        address
      );

      return { geocoded: true };
    }

    if (input.fieldKey === "coordinates") {
      const { lat, lng } = validated as { lat: number; lng: number };

      // Reverse geocoding inside the service keeps the stored address describing
      // where the clinic now is, rather than where it used to be (decision 4).
      await this.deps.locationService.applyLocation({
        facilityId: input.facilityId,
        lat,
        lng,
        acceptCoverageLoss: input.acceptCoverageLoss,
      });

      return { geocoded: false };
    }

    if (
      input.fieldKey === "legalDocument" ||
      input.fieldKey === "legalDocumentType"
    ) {
      const facility = await this.deps.facilityRepository.findById(input.facilityId);
      if (!facility) {
        throw new ValidationError([
          { field: "facilityId", message: "Facility not found" },
        ]);
      }

      const result = validateLegalDocument({
        legalDocumentType:
          input.fieldKey === "legalDocumentType"
            ? (validated as "CNPJ" | "CPF")
            : facility.legalDocumentType,
        legalDocument:
          input.fieldKey === "legalDocument"
            ? (validated as string)
            : facility.legalDocument,
        typeField: "proposedValue",
        documentField: "proposedValue",
      });
      if (!result.ok) {
        throw new ValidationError(result.issues);
      }

      await this.deps.facilityRepository.applyApprovedFieldUpdates(input.facilityId, {
        legalDocumentType: result.legalDocumentType,
        legalDocument: normalizeLegalDocument(result.legalDocument),
      });
      return { geocoded: false };
    }

    const updates: Parameters<FacilityRepository["applyApprovedFieldUpdates"]>[1] = {};

    switch (input.fieldKey) {
      case "displayName":
        updates.name = validated as string;
        break;
      case "phoneNumber":
        updates.phoneNumber = validated as string;
        break;
      case "whatsappNumber":
        updates.whatsappNumber = validated as string;
        break;
      case "email":
        updates.email = validated as string;
        break;
      case "websiteUrl":
        updates.websiteUrl = validated as string;
        break;
      case "responsibleName":
        updates.responsibleName = validated as string;
        break;
      case "openingHours":
        updates.openingHours = validated as string;
        break;
    }

    await this.deps.facilityRepository.applyApprovedFieldUpdates(
      input.facilityId,
      updates
    );
    return { geocoded: false };
  }
}
