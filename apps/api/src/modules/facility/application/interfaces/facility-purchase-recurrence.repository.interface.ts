import type { PurchaseProfile, PurchaseRecurrenceSnapshot } from "@atlasmed/facility-insights";
import type { FacilityRecord } from "./facility.repository.interface";

export interface ManualPurchaseConfiguration {
  manualProfile: PurchaseProfile | null;
  manualIntervalDays: number | null;
}

export interface FacilityUpdateFields {
  name?: string;
  manuallyEditedAt?: Date;
}

export interface LockedFacilityPurchaseRecurrence {
  purchaseDates: string[];
  configuration: ManualPurchaseConfiguration;
  verticalId: string;
}

export interface DesiredPurchaseRecurrenceUpdate<T> {
  configuration: ManualPurchaseConfiguration;
  snapshot: PurchaseRecurrenceSnapshot;
  result: T;
}

export interface FacilityPurchaseRecurrenceRepository {
  /**
   * Lock one facility×vertical profile, recalc from orders of that vertical,
   * persist profile + facility rollup. Optional facility display fields.
   */
  withLockedProfile<T>(
    facilityId: string,
    verticalId: string,
    callback: (
      facility: LockedFacilityPurchaseRecurrence,
    ) => Promise<DesiredPurchaseRecurrenceUpdate<T>>,
    fields?: FacilityUpdateFields,
  ): Promise<{ result: T; facility: FacilityRecord } | null>;

  /** Recalc every active profile for a facility (worker backfill/reconcile). */
  recalculateAllProfiles(
    facilityId: string,
    today: string,
  ): Promise<{ changed: boolean } | null>;
}
