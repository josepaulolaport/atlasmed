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
}

export interface DesiredPurchaseRecurrenceUpdate<T> {
  configuration: ManualPurchaseConfiguration;
  snapshot: PurchaseRecurrenceSnapshot;
  result: T;
}

export interface FacilityPurchaseRecurrenceRepository {
  withLockedFacility<T>(
    facilityId: string,
    callback: (
      facility: LockedFacilityPurchaseRecurrence,
    ) => Promise<DesiredPurchaseRecurrenceUpdate<T>>,
    fields?: FacilityUpdateFields,
  ): Promise<{ result: T; facility: FacilityRecord } | null>;
}
