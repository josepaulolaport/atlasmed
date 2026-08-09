import { assertResourceInScope, type ScopeContext } from "@atlasmed/access";
import {
  PURCHASE_PROFILE_INTERVAL_DAYS,
  PurchaseRecurrenceValidationError,
  calculatePurchaseRecurrenceSnapshot,
  type PurchaseProfile,
  type PurchaseRecurrenceSnapshot,
} from "@atlasmed/facility-insights";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  FacilityPurchaseRecurrenceRepository,
  FacilityUpdateFields,
  ManualPurchaseConfiguration,
} from "../interfaces/facility-purchase-recurrence.repository.interface";
import type { FacilityRecord } from "../interfaces/facility.repository.interface";

export type PurchaseRecurrenceCommand =
  | { mode: "AUTOMATIC" }
  | { mode: "PRESET"; profile: Exclude<PurchaseProfile, "CUSTOM"> }
  | { mode: "CUSTOM"; intervalDays: number };

export function configurationFor(command: PurchaseRecurrenceCommand): ManualPurchaseConfiguration {
  switch (command.mode) {
    case "AUTOMATIC":
      return { manualProfile: null, manualIntervalDays: null };
    case "PRESET":
      if (!(command.profile in PURCHASE_PROFILE_INTERVAL_DAYS)) {
        throw new ValidationError([{ field: "purchaseRecurrence.profile", message: "Invalid preset profile" }]);
      }
      return { manualProfile: command.profile, manualIntervalDays: null };
    case "CUSTOM":
      if (!Number.isInteger(command.intervalDays) || command.intervalDays < 1 || command.intervalDays > 3650) {
        throw new ValidationError([{
          field: "purchaseRecurrence.intervalDays",
          message: "Interval must be an integer from 1 to 3650",
        }]);
      }
      return { manualProfile: "CUSTOM", manualIntervalDays: command.intervalDays };
  }
}

export function calculatePurchaseRecurrence(input: {
  purchaseDates: string[];
  configuration: ManualPurchaseConfiguration;
  today: string;
}): PurchaseRecurrenceSnapshot {
  try {
    return calculatePurchaseRecurrenceSnapshot({
      purchaseDates: input.purchaseDates,
      manualProfile: input.configuration.manualProfile,
      manualIntervalDays: input.configuration.manualIntervalDays,
      today: input.today,
    });
  } catch (error) {
    if (error instanceof PurchaseRecurrenceValidationError) {
      throw new ValidationError([{
        field: error.field === "manualProfile"
          ? "purchaseRecurrence.profile"
          : error.field === "manualIntervalDays"
            ? "purchaseRecurrence.intervalDays"
            : error.field,
        message: error.message,
      }]);
    }
    throw error;
  }
}

export class PurchaseRecurrenceService {
  constructor(private readonly repository: FacilityPurchaseRecurrenceRepository) {}

  prepareConfiguration(command: PurchaseRecurrenceCommand): ManualPurchaseConfiguration {
    return configurationFor(command);
  }

  async recalculateFacility(
    facilityId: number,
    verticalId: number,
    today: string,
  ): Promise<PurchaseRecurrenceSnapshot> {
    const saved = await this.repository.withLockedProfile(
      facilityId,
      verticalId,
      async (facility) => {
        const snapshot = calculatePurchaseRecurrence({
          purchaseDates: facility.purchaseDates,
          configuration: facility.configuration,
          today,
        });
        return { configuration: facility.configuration, snapshot, result: snapshot };
      },
    );
    if (!saved) throw new ResourceNotFoundError("Facility", facilityId);
    return saved.result;
  }

  async updateFacility(
    facilityId: number,
    verticalId: number,
    input: {
      fields: FacilityUpdateFields;
      configuration: ManualPurchaseConfiguration;
      today: string;
    },
  ): Promise<FacilityRecord> {
    const saved = await this.repository.withLockedProfile(
      facilityId,
      verticalId,
      async (facility) => {
        const snapshot = calculatePurchaseRecurrence({
          purchaseDates: facility.purchaseDates,
          configuration: input.configuration,
          today: input.today,
        });
        return { configuration: input.configuration, snapshot, result: undefined };
      },
      input.fields,
    );
    if (!saved) throw new ResourceNotFoundError("Facility", facilityId);
    return saved.facility;
  }

  async configurePurchaseRecurrence(
    facilityId: number,
    verticalId: number,
    command: PurchaseRecurrenceCommand,
    scope: ScopeContext,
    today: string,
  ): Promise<PurchaseRecurrenceSnapshot> {
    assertResourceInScope(scope, "facility", facilityId);
    const configuration = this.prepareConfiguration(command);
    const saved = await this.repository.withLockedProfile(
      facilityId,
      verticalId,
      async (facility) => {
        const snapshot = calculatePurchaseRecurrence({
          purchaseDates: facility.purchaseDates,
          configuration,
          today,
        });
        return { configuration, snapshot, result: snapshot };
      },
    );
    if (!saved) throw new ResourceNotFoundError("Facility", facilityId);
    return saved.result;
  }

  async recalculateAllProfiles(
    facilityId: number,
    today: string,
  ): Promise<{ changed: boolean } | null> {
    return this.repository.recalculateAllProfiles(facilityId, today);
  }
}
