export type PotentialDefinitionRecord = {
  id: string;
  verticalId: string;
  key: string;
  label: string;
  sortOrder: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FacilityPotentialValueRecord = {
  facilityId: string;
  definitionId: string;
  quantity: number;
  updatedByUserId: string | null;
  updatedAt: Date;
};

export type ProductPotentialLinkRecord = {
  productId: string;
  definitionId: string;
  productName: string;
  productCode: string;
};

export type DefinitionQtySum = {
  definitionId: string;
  totalQty: number;
};

export interface PotentialRepository {
  listDefinitions(input: {
    verticalId: string;
    includeDeleted?: boolean;
  }): Promise<PotentialDefinitionRecord[]>;

  findDefinitionById(id: string): Promise<PotentialDefinitionRecord | null>;

  createDefinition(input: {
    verticalId: string;
    key: string;
    label: string;
    sortOrder: number;
  }): Promise<PotentialDefinitionRecord>;

  updateDefinition(input: {
    id: string;
    label?: string;
    sortOrder?: number;
  }): Promise<PotentialDefinitionRecord | null>;

  softDeleteDefinition(id: string): Promise<boolean>;

  listFacilityValues(input: {
    facilityId: string;
    definitionIds: string[];
  }): Promise<FacilityPotentialValueRecord[]>;

  upsertFacilityValue(input: {
    facilityId: string;
    definitionId: string;
    quantity: number;
    updatedByUserId: string;
  }): Promise<void>;

  deleteFacilityValue(input: {
    facilityId: string;
    definitionId: string;
  }): Promise<void>;

  /** Sum SALE item qty over rolling window, keyed by definition. */
  sumAtlasmedQtyByDefinition(input: {
    facilityId: string;
    definitionIds: string[];
    since: Date;
  }): Promise<DefinitionQtySum[]>;

  linkProduct(input: {
    productId: string;
    definitionId: string;
  }): Promise<void>;

  unlinkProduct(productId: string): Promise<boolean>;

  listProductsForDefinition(
    definitionId: string,
  ): Promise<ProductPotentialLinkRecord[]>;

  productBelongsToVertical(input: {
    productId: string;
    verticalId: string;
  }): Promise<boolean>;

  findLinkByProductId(
    productId: string,
  ): Promise<{ productId: string; definitionId: string } | null>;
}
