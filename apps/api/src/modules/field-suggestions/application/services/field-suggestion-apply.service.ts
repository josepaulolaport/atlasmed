import {
  OperationNotAllowedError,
  ValidationError,
} from "../../../../shared/errors";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type {
  AddressParts,
  FacilityGeocodingService,
} from "../../../facility/application/services/facility-geocoding.service";
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

export class FieldSuggestionApplyService {
  constructor(
    private readonly deps: {
      facilityRepository: FacilityRepository;
      facilityGeocodingService: FacilityGeocodingService;
      onFacilityLocationChanged?: (facilityId: number) => Promise<void>;
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
      case "legalDocument":
        return asNonEmptyString(proposedValue, "proposedValue");
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
    }
  }

  async applyFieldChange(input: {
    facilityId: number;
    fieldKey: FieldSuggestionFieldKey;
    proposedValue: unknown;
  }): Promise<{ geocoded: boolean }> {
    const validated = this.validateProposedValue(input.fieldKey, input.proposedValue);

    if (input.fieldKey === "address") {
      const address = validated as AddressParts;
      const coords = await this.deps.facilityGeocodingService.geocodeAddress(address);
      if (!coords) {
        throw new OperationNotAllowedError(
          "approve_field_suggestion",
          "Não foi possível geocodificar o endereço sugerido"
        );
      }

      await this.deps.facilityRepository.applyApprovedFieldUpdates(input.facilityId, {
        ...address,
        lat: coords.lat,
        lng: coords.lng,
      });

      await this.deps.onFacilityLocationChanged?.(input.facilityId);
      return { geocoded: true };
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
