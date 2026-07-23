import {
  OperationNotAllowedError,
  ValidationError,
} from "../../../../shared/errors";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type {
  AddressParts,
  FacilityGeocodingService,
} from "../../../facility/application/services/facility-geocoding.service";
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
      onFacilityLocationChanged?: (facilityId: string) => Promise<void>;
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
      case "cnpj":
      case "cpf":
        return asNonEmptyString(proposedValue, "proposedValue");
      case "taxIdType": {
        const value = asNonEmptyString(proposedValue, "proposedValue");
        if (value !== "PJ" && value !== "PF") {
          throw new ValidationError([
            { field: "proposedValue", message: "taxIdType must be PJ or PF" },
          ]);
        }
        return value;
      }
      case "address":
        return parseAddress(proposedValue);
    }
  }

  async applyFieldChange(input: {
    facilityId: string;
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
        manuallyEditedAt: new Date(),
      });

      await this.deps.onFacilityLocationChanged?.(input.facilityId);
      return { geocoded: true };
    }

    const updates: Parameters<FacilityRepository["applyApprovedFieldUpdates"]>[1] = {
      manuallyEditedAt: new Date(),
    };

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
      case "taxIdType":
        updates.taxIdType = validated as "PJ" | "PF";
        break;
      case "cnpj":
        updates.cnpj = validated as string;
        break;
      case "cpf":
        updates.cpf = validated as string;
        break;
    }

    await this.deps.facilityRepository.applyApprovedFieldUpdates(
      input.facilityId,
      updates
    );
    return { geocoded: false };
  }
}
