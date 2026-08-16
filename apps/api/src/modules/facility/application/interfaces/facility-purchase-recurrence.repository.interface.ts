import type { PurchaseProfile, PurchaseRecurrenceSnapshot } from "@atlasmed/facility-insights";
import type { FacilityRecord } from "./facility.repository.interface";

export interface ManualPurchaseConfiguration {
  manualProfile: PurchaseProfile | null;
  manualIntervalDays: number | null;
}

export interface FacilityUpdateFields {
  name?: string;
}

export interface LockedFacilityPurchaseRecurrence {
  purchaseDates: string[];
  configuration: ManualPurchaseConfiguration;
  verticalId: number;
}

export interface DesiredPurchaseRecurrenceUpdate<T> {
  configuration: ManualPurchaseConfiguration;
  snapshot: PurchaseRecurrenceSnapshot;
  result: T;
}

export interface FacilityPurchaseRecurrenceRepository {
  /**
   * Lock one facility×vertical profile, recalc from orders of that vertical,
   * persist profile snapshot. Optional facility display fields.
   */
  withLockedProfile<T>(
    facilityId: number,
    verticalId: number,
    callback: (
      facility: LockedFacilityPurchaseRecurrence,
    ) => Promise<DesiredPurchaseRecurrenceUpdate<T>>,
    fields?: FacilityUpdateFields,
  ): Promise<{ result: T; facility: FacilityRecord } | null>;
}
