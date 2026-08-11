import type { MonthKey } from "@atlasmed/facility-insights";

export type PotentialDefinitionRecord = {
  id: number;
  verticalId: number;
  key: string;
  label: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** One competitor product's quantity at a clinic, for one metric, in one month. */
export type FacilityProductUsageRecord = {
  definitionId: number;
  productId: number;
  productName: string;
  /** The month this observation is about. */
  month: MonthKey;
  /** Product units, exactly as the rep entered them. */
  quantity: number;
  /** quantity × the product's `metric_units` — comparable with our own side. */
  metricQuantity: number;
  updatedAt: Date;
};

export type ProductPotentialLinkRecord = {
  productId: number;
  definitionId: number;
  productName: string;
  productCode: string | null;
};

export type DefinitionQtySum = {
  definitionId: number;
  totalQty: number;
};

/** Our quantity for one metric in one calendar month, in metric units. */
export type DefinitionMonthQtySum = DefinitionQtySum & {
  month: MonthKey;
};

export type ProfileRecord = {
  id: number;
  facilityId: number;
  verticalId: number;
};

/**
 * One computed snapshot row.
 *
 * `computedAt` is supplied by the caller rather than defaulted in SQL: the sweep
 * needs to compare it against input timestamps, and a value the handler chooses
 * is one the tests can pin.
 */
export type MetricSnapshotWrite = {
  profileId: number;
  definitionId: number;
  verticalId: number;
  month: MonthKey;
  oursQty: number;
  theirsQty: number;
  computedAt: Date;
};

export interface PotentialRepository {
  listDefinitions(input: {
    verticalId: number;
    includeDeleted?: boolean;
  }): Promise<PotentialDefinitionRecord[]>;

  findDefinitionById(id: number): Promise<PotentialDefinitionRecord | null>;

  createDefinition(input: {
    verticalId: number;
    key: string;
    label: string;
  }): Promise<PotentialDefinitionRecord>;

  updateDefinition(input: {
    id: number;
    label?: string;
  }): Promise<PotentialDefinitionRecord | null>;

  softDeleteDefinition(id: number): Promise<boolean>;

  /** The commercial unit a clinic's linha corresponds to, or null. */
  findProfileId(input: {
    facilityId: number;
    verticalId: number;
  }): Promise<number | null>;

  findProfileById(profileId: number): Promise<ProfileRecord | null>;

  /** Replaces whole rows — never a delta, so re-running is safe. */
  upsertMetricSnapshots(rows: MetricSnapshotWrite[]): Promise<void>;

  /** Existing (definition, month) pairs, so vanished inputs can be zeroed. */
  listMetricSnapshotKeys(input: {
    profileId: number;
    months: MonthKey[];
  }): Promise<Array<{ definitionId: number; month: MonthKey }>>;

  /** Competitor quantities for the given months. */
  listUsage(input: {
    profileId: number;
    definitionIds: number[];
    months: MonthKey[];
  }): Promise<FacilityProductUsageRecord[]>;

  /** Replaces the quantity for this (profile, definition, product, month). */
  upsertUsage(input: {
    profileId: number;
    definitionId: number;
    verticalId: number;
    productId: number;
    month: MonthKey;
    quantity: number;
    updatedByUserId: number;
  }): Promise<void>;

  deleteUsage(input: {
    profileId: number;
    definitionId: number;
    productId: number;
    month: MonthKey;
  }): Promise<boolean>;

  /**
   * Sum eligible order-item quantities (× `metric_units`) for **one calendar
   * month**, keyed by definition.
   *
   * The bounds are supplied rather than derived from the clock: that is what
   * lets the same month be recomputed to the same number, which the snapshot
   * cache depends on (spec 0013 §4.3).
   *
   * `verticalId` is required, not optional: without it this summed every linha's
   * orders into each linha's penetration (spec 0010 §4).
   */
  sumAtlasmedQtyByDefinitionAndMonth(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<DefinitionMonthQtySum[]>;

  /** Replaces the product's link within `verticalId`; other linhas untouched. */
  linkProduct(input: {
    productId: number;
    definitionId: number;
    verticalId: number;
  }): Promise<void>;

  unlinkProduct(input: {
    productId: number;
    definitionId: number;
  }): Promise<boolean>;

  listProductsForDefinition(
    definitionId: number,
  ): Promise<ProductPotentialLinkRecord[]>;

  productBelongsToVertical(input: {
    productId: number;
    verticalId: number;
  }): Promise<boolean>;

  /** A product may be linked in several linhas, so the definition is required. */
  findLink(input: {
    productId: number;
    definitionId: number;
  }): Promise<{ productId: number; definitionId: number; verticalId: number } | null>;
}
