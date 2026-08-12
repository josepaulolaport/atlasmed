
export type PotentialDefinitionRecord = {
  id: number;
  verticalId: number;
  key: string;
  label: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** The quantity standing for one competitor product at a clinic, for one metric. */
export type FacilityProductUsageRecord = {
  definitionId: number;
  productId: number;
  productName: string;
  /** Per month, in the product's own units, exactly as the rep entered them. */
  quantity: number;
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



  /**
   * The quantity standing for each competitor product of a metric.
   *
   * One row per product (§4.6) — a rep answers "quantas por mês" once and
   * replaces it. Only products still linked to the metric are returned.
   */
  listUsage(input: {
    profileId: number;
    definitionIds: number[];
  }): Promise<FacilityProductUsageRecord[]>;

  /** Our own quantity over a date range, broken down by product. */
  sumAtlasmedQtyByDefinitionAndProduct(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<AtlasmedProductQtySum[]>;

  /**
   * Replaces the quantity standing for this (profile, definition, product).
   *
   * One figure per product (§4.6) — recording again replaces rather than adds a
   * second answer. Must be > 0; "they sell none here" is the snapshot's
   * `noOtherBrands` claim, not a zero.
   */
  upsertUsage(input: {
    profileId: number;
    definitionId: number;
    verticalId: number;
    productId: number;
    quantity: number;
    updatedByUserId: number;
  }): Promise<void>;

  /**
   * Records or withdraws the rep's claim that no other brand is sold here.
   *
   * Upserts the snapshot row when none exists yet: the claim can be made about a
   * clinic nothing has been computed for.
   */
  setNoOtherBrands(input: {
    profileId: number;
    definitionId: number;
    verticalId: number;
    value: boolean;
  }): Promise<void>;

  /** Whether the claim stands, per metric. */
  listNoOtherBrands(input: {
    profileId: number;
    definitionIds: number[];
  }): Promise<Array<{ definitionId: number; noOtherBrands: boolean; setAt: Date | null }>>;

  /** Removes a competitor product from a metric. One row, so one delete. */
  deleteUsageForProduct(input: {
    profileId: number;
    definitionId: number;
    productId: number;
  }): Promise<boolean>;

  /** Eligible order quantities over a date range, summed per metric. */
  sumAtlasmedQtyByDefinition(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    rangeStart: Date;
    rangeEnd: Date;
  }): Promise<Array<{ definitionId: number; totalQty: number }>>;

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


export interface AtlasmedProductQtySum {
  definitionId: number;
  productId: number;
  productName: string;
  /** Product units over the requested range, not yet normalised to a month. */
  totalQty: number;
}
