export type PotentialDefinitionRecord = {
  id: number;
  verticalId: number;
  key: string;
  label: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FacilityPotentialValueRecord = {
  facilityId: number;
  definitionId: number;
  quantity: number;
  updatedByUserId: number | null;
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

  listFacilityValues(input: {
    facilityId: number;
    definitionIds: number[];
  }): Promise<FacilityPotentialValueRecord[]>;

  upsertFacilityValue(input: {
    facilityId: number;
    definitionId: number;
    quantity: number;
    updatedByUserId: number;
  }): Promise<void>;

  deleteFacilityValue(input: {
    facilityId: number;
    definitionId: number;
  }): Promise<void>;

  /**
   * Sum SALE item qty over rolling window, keyed by definition.
   *
   * `verticalId` is required, not optional: without it this summed every linha's
   * orders into each linha's penetration (spec 0010 §4).
   */
  sumAtlasmedQtyByDefinition(input: {
    facilityId: number;
    verticalId: number;
    definitionIds: number[];
    since: Date;
  }): Promise<DefinitionQtySum[]>;

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
