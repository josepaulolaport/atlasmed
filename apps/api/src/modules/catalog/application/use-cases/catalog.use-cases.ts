import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import {
  ForbiddenError,
  ResourceInUseError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import { resolveVerticalIds } from "../../../access/application/services/vertical-access.service";
import type { BusinessVerticalRepository } from "../interfaces/business-vertical.repository.interface";
import type {
  CreateProductInput,
  ProductRecord,
  ProductRepository,
  UpdateProductInput,
} from "../interfaces/product.repository.interface";
import type {
  HealthcareProviderRepository,
  HealthcareProviderType,
} from "../interfaces/healthcare-provider.repository.interface";
import type { FacilityHealthcareProviderShareRepository } from "../interfaces/facility-healthcare-provider-share.repository.interface";
import type { FacilityVerticalAccessRepository } from "../interfaces/facility-vertical-access.repository.interface";
import type {
  CompetitorProductRecord,
  CompetitorProductRepository,
} from "../interfaces/competitor-product.repository.interface";
import type { ProductEquivalenceRepository } from "../interfaces/product-equivalence.repository.interface";
import { assertPayerSharesOrtopediaAccess } from "../services/payer-shares-access.service";

function productVisibleInVerticals(product: ProductRecord, verticalIds: number[]): boolean {
  return product.verticalIds.some((id) => verticalIds.includes(id));
}

function serializeBusinessVertical(row: {
  id: number;
  code: string | null;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeProduct(row: ProductRecord) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    commercialCode: row.commercialCode,
    productGroup: row.productGroup,
    productClassification: row.productClassification,
    internalClassification: row.internalClassification,
    brand: row.brand,
    unit: row.unit,
    barcode: row.barcode,
    ncm: row.ncm,
    anvisaRegistration: row.anvisaRegistration,
    requiresSterilization: row.requiresSterilization,
    idProdutoEmultec: row.idProdutoEmultec,
    verticalIds: row.verticalIds,
    pictureUrl: row.pictureUrl,
    pictureBlurhash: row.pictureBlurhash,
    simproCode: row.simproCode,
    brasindiceCode: row.brasindiceCode,
    tissCode: row.tissCode,
    manufacturer: row.manufacturer,
    countryOfOrigin: row.countryOfOrigin,
    price: row.price,
    price17: row.price17,
    price18: row.price18,
    price20: row.price20,
    brasindiceUpdatedAt: row.brasindiceUpdatedAt,
    /** Informative only — spec 0016 §7.1. Displayed, never multiplied, never written. */
    metricUnits: row.metricUnits,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeProvider(row: {
  id: number;
  name: string;
  type: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ListBusinessVerticalsUseCase {
  constructor(private readonly deps: { businessVerticalRepository: BusinessVerticalRepository }) {}

  async execute(input: { page?: number; limit?: number; isActive?: boolean }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const { verticals, total } = await this.deps.businessVerticalRepository.findAll({
      page,
      limit,
      isActive: input.isActive,
    });

    return {
      data: verticals.map(serializeBusinessVertical),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class CreateBusinessVerticalUseCase {
  constructor(private readonly deps: { businessVerticalRepository: BusinessVerticalRepository }) {}

  async execute(input: { code: string; name: string; isActive?: boolean }) {
    const vertical = await this.deps.businessVerticalRepository.create(input);
    return serializeBusinessVertical(vertical);
  }
}

export class UpdateBusinessVerticalUseCase {
  constructor(private readonly deps: { businessVerticalRepository: BusinessVerticalRepository }) {}

  /**
   * `code` is not updatable (spec 0016 §4.1). It is a stable key other data
   * joins on by meaning, and there is no screen that edits a Linha at all —
   * so the only thing an accepted `code` could do here is let one drift.
   */
  async execute(input: { verticalId: number; name?: string; isActive?: boolean }) {
    const vertical = await this.deps.businessVerticalRepository.update(input.verticalId, {
      name: input.name,
      isActive: input.isActive,
    });
    return serializeBusinessVertical(vertical);
  }
}

export class ListProductsUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: {
    page?: number;
    limit?: number;
    verticalId?: number;
    search?: string;
    isActive?: boolean;
    scope: ScopeContext;
    role: string;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const verticalIds = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });

    if (verticalIds.length === 0) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
      };
    }

    const { products, total } = await this.deps.productRepository.findAll({
      page,
      limit,
      verticalIds,
      search: input.search,
      isActive: input.isActive,
    });

    return {
      data: products.map(serializeProduct),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class GetProductUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: {
    productId: number;
    scope: ScopeContext;
    role: string;
    verticalId?: number;
  }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) throw new ResourceNotFoundError("Product", input.productId);

    const verticalIds = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });
    if (!productVisibleInVerticals(product, verticalIds)) {
      throw new ForbiddenError();
    }

    // Whether delete is available, and what blocks it (spec 0016 §6.2). Sent on
    // the detail read so the client can disable the action with a reason rather
    // than offer it and let it 409 — the difference between a rule and a
    // surprise.
    const references = await this.deps.productRepository.findReferences(
      input.productId
    );
    return {
      ...serializeProduct(product),
      deletable: Object.keys(references).length === 0,
      blockingReferences: references,
    };
  }
}

/**
 * Hard-deletes a product, but only while nothing references it (spec 0016 §6.2).
 *
 * Not a soft delete and not an unconditional one. A product nothing points at is
 * a mistake someone wants gone; a product with orders, recorded quantities,
 * equivalences or a metric link is history, and removing it would either cascade
 * over field-collected data — which spec 0013 §4.1 says a catalogue edit never
 * invalidates — or fail on a foreign key the admin cannot act on. So the refusal
 * names what blocks it and the answer is `isActive = false` instead.
 */
export class DeleteProductUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: { productId: number }) {
    const outcome = await this.deps.productRepository.deleteIfUnreferenced(
      input.productId
    );
    if (!outcome.found) {
      throw new ResourceNotFoundError("Product", input.productId);
    }
    if (!outcome.deleted) {
      throw new ResourceInUseError("Product", outcome.references);
    }
    return { id: input.productId, deleted: true };
  }
}

export class CreateProductUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: CreateProductInput) {
    if (input.verticalIds.length === 0) {
      throw new ValidationError([
        { field: "verticalIds", message: "A product must belong to at least one Linha" },
      ]);
    }
    const product = await this.deps.productRepository.create(input);
    return serializeProduct(product);
  }
}

export class UpdateProductUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  /**
   * `verticalIds` is absent by decision (spec 0016 §6.7): a product's Linhas are
   * fixed at creation. The route does not accept them either, so this is the
   * second of two places that would have to change to reintroduce the move.
   */
  async execute(input: UpdateProductInput & { productId: number }) {
    const { productId, ...fields } = input;
    const product = await this.deps.productRepository.update(productId, fields);
    return serializeProduct(product);
  }
}

export class ListHealthcareProvidersUseCase {
  constructor(
    private readonly deps: { healthcareProviderRepository: HealthcareProviderRepository }
  ) {}

  async execute(input: { page?: number; limit?: number; isActive?: boolean }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const { providers, total } = await this.deps.healthcareProviderRepository.findAll({
      page,
      limit,
      isActive: input.isActive,
    });

    return {
      data: providers.map(serializeProvider),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class CreateHealthcareProviderUseCase {
  constructor(
    private readonly deps: { healthcareProviderRepository: HealthcareProviderRepository }
  ) {}

  async execute(input: { name: string; type: HealthcareProviderType; isActive?: boolean }) {
    const provider = await this.deps.healthcareProviderRepository.create(input);
    return serializeProvider(provider);
  }
}

export class UpdateHealthcareProviderUseCase {
  constructor(
    private readonly deps: { healthcareProviderRepository: HealthcareProviderRepository }
  ) {}

  async execute(input: {
    providerId: number;
    name?: string;
    type?: HealthcareProviderType;
    isActive?: boolean;
  }) {
    const provider = await this.deps.healthcareProviderRepository.update(input.providerId, {
      name: input.name,
      type: input.type,
      isActive: input.isActive,
    });
    return serializeProvider(provider);
  }
}

function serializeFacilityShare(share: {
  id: number;
  facilityId: number;
  healthcareProviderId: number;
  sharePercent: number;
  isPackage: boolean;
  createdAt: Date;
  updatedAt: Date;
  healthcareProvider: { id: number; name: string; type: string };
}) {
  return {
    id: share.id,
    facilityId: share.facilityId,
    healthcareProviderId: share.healthcareProviderId,
    sharePercent: share.sharePercent,
    isPackage: share.isPackage,
    healthcareProvider: share.healthcareProvider,
    createdAt: share.createdAt.toISOString(),
    updatedAt: share.updatedAt.toISOString(),
  };
}

export class ListFacilityHealthcareProviderSharesUseCase {
  constructor(
    private readonly deps: {
      shareRepository: FacilityHealthcareProviderShareRepository;
      facilityVerticalAccess: FacilityVerticalAccessRepository;
    }
  ) {}

  async execute(input: { facilityId: number; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    await assertPayerSharesOrtopediaAccess({
      facilityId: input.facilityId,
      scope: input.scope,
      facilityVerticalAccess: this.deps.facilityVerticalAccess,
    });
    const shares = await this.deps.shareRepository.findByFacility(input.facilityId);

    return {
      data: shares.map(serializeFacilityShare),
    };
  }
}

export class CreateFacilityHealthcareProviderShareUseCase {
  constructor(
    private readonly deps: {
      shareRepository: FacilityHealthcareProviderShareRepository;
      facilityVerticalAccess: FacilityVerticalAccessRepository;
    }
  ) {}

  async execute(input: {
    facilityId: number;
    healthcareProviderId: number;
    sharePercent: number;
    isPackage?: boolean;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    await assertPayerSharesOrtopediaAccess({
      facilityId: input.facilityId,
      scope: input.scope,
      facilityVerticalAccess: this.deps.facilityVerticalAccess,
    });

    if (input.sharePercent <= 0 || input.sharePercent > 100) {
      throw new ValidationError([
        { field: "sharePercent", message: "Share percent must be between 0 and 100" },
      ]);
    }

    const existingTotal = await this.deps.shareRepository.sumSharePercentForFacility(
      input.facilityId
    );

    if (existingTotal + input.sharePercent > 100.01) {
      throw new ValidationError([
        {
          field: "sharePercent",
          message: `Total share would exceed 100% (current: ${existingTotal}%)`,
        },
      ]);
    }

    const share = await this.deps.shareRepository.create({
      facilityId: input.facilityId,
      healthcareProviderId: input.healthcareProviderId,
      sharePercent: input.sharePercent,
      isPackage: input.isPackage ?? false,
    });

    return {
      id: share.id,
      facilityId: share.facilityId,
      healthcareProviderId: share.healthcareProviderId,
      sharePercent: share.sharePercent,
      isPackage: share.isPackage,
      healthcareProvider: share.healthcareProvider,
      createdAt: share.createdAt.toISOString(),
    };
  }
}

export class ReplaceFacilityHealthcareProviderSharesUseCase {
  constructor(
    private readonly deps: {
      shareRepository: FacilityHealthcareProviderShareRepository;
      facilityVerticalAccess: FacilityVerticalAccessRepository;
    }
  ) {}

  async execute(input: {
    facilityId: number;
    scope: ScopeContext;
    shares: Array<{
      healthcareProviderId: number;
      sharePercent: number;
      isPackage?: boolean;
    }>;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    await assertPayerSharesOrtopediaAccess({
      facilityId: input.facilityId,
      scope: input.scope,
      facilityVerticalAccess: this.deps.facilityVerticalAccess,
    });

    const issues: Array<{ field: string; message: string }> = [];
    const seen = new Set<number>();

    for (let index = 0; index < input.shares.length; index += 1) {
      const share = input.shares[index]!;
      const field = `shares[${index}]`;

      if (!(typeof share.healthcareProviderId === "number") || share.healthcareProviderId <= 0) {
        issues.push({ field: `${field}.healthcareProviderId`, message: "Required" });
        continue;
      }

      if (seen.has(share.healthcareProviderId)) {
        issues.push({
          field: `${field}.healthcareProviderId`,
          message: "Duplicate healthcare provider",
        });
      }
      seen.add(share.healthcareProviderId);

      if (
        typeof share.sharePercent !== "number" ||
        Number.isNaN(share.sharePercent) ||
        share.sharePercent <= 0 ||
        share.sharePercent > 100
      ) {
        issues.push({
          field: `${field}.sharePercent`,
          message: "Share percent must be between 0 and 100",
        });
      }

      if (share.isPackage !== undefined && typeof share.isPackage !== "boolean") {
        issues.push({
          field: `${field}.isPackage`,
          message: "Must be a boolean",
        });
      }
    }

    const total = input.shares.reduce((sum, share) => sum + (share.sharePercent || 0), 0);
    if (input.shares.length > 0 && Math.abs(total - 100) > 0.01) {
      issues.push({
        field: "shares",
        message: `Shares must sum to 100% (current: ${total}%)`,
      });
    }

    if (issues.length > 0) {
      throw new ValidationError(issues);
    }

    const replaced = await this.deps.shareRepository.replaceByFacility(
      input.facilityId,
      input.shares.map((share) => ({
        healthcareProviderId: share.healthcareProviderId,
        sharePercent: share.sharePercent,
        isPackage: share.isPackage ?? false,
      }))
    );

    return {
      data: replaced.map(serializeFacilityShare),
    };
  }
}

// ============================================================================
// Competitor products & product equivalences ("comparativo" / price index)
// ============================================================================

function serializeCompetitorProduct(row: CompetitorProductRecord) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    manufacturer: row.manufacturer,
    brand: row.brand,
    countryOfOrigin: row.countryOfOrigin,
    price17: row.price17,
    price18: row.price18,
    price20: row.price20,
    brasindiceUpdatedAt: row.brasindiceUpdatedAt,
    isActive: row.isActive,
    // Omitted rather than defaulted to 0 on reads that do not compute it —
    // "not asked" and "none" are different answers (spec 0016 §5.3).
    ...(row.equivalenceCount === undefined
      ? {}
      : { equivalenceCount: row.equivalenceCount }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ComparisonSortColumn = "icms17" | "icms18" | "icms20";

export interface ComparisonRow {
  id: number;
  label: string;
  manufacturer: string;
  countryOfOrigin: string;
  price17: number;
  price18: number;
  price20: number;
  /** Brasíndice revision date; null when the product has no Brasíndice code. */
  updatedAt: string | null;
  isOwn: boolean;
}

function priceForColumn(row: ComparisonRow, column: ComparisonSortColumn): number {
  switch (column) {
    case "icms17":
      return row.price17;
    case "icms18":
      return row.price18;
    case "icms20":
      return row.price20;
  }
}

function sortRowsByPrice(rows: ComparisonRow[], column: ComparisonSortColumn): ComparisonRow[] {
  return [...rows].sort((a, b) => priceForColumn(b, column) - priceForColumn(a, column));
}

function productToComparisonRow(product: ProductRecord): ComparisonRow {
  return {
    id: product.id,
    label: product.name,
    manufacturer: product.manufacturer,
    countryOfOrigin: product.countryOfOrigin,
    price17: product.price17,
    price18: product.price18,
    price20: product.price20,
    updatedAt: product.brasindiceUpdatedAt,
    isOwn: true,
  };
}

function competitorToComparisonRow(competitor: CompetitorProductRecord): ComparisonRow {
  return {
    id: competitor.id,
    label: competitor.name,
    manufacturer: competitor.manufacturer ?? "",
    countryOfOrigin: competitor.countryOfOrigin ?? "",
    price17: competitor.price17 ?? 0,
    price18: competitor.price18 ?? 0,
    price20: competitor.price20 ?? 0,
    updatedAt: competitor.brasindiceUpdatedAt ?? "",
    isOwn: false,
  };
}

export class ListCompetitorProductsUseCase {
  constructor(
    private readonly deps: { competitorProductRepository: CompetitorProductRepository }
  ) {}

  async execute(input: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const { competitorProducts, total } = await this.deps.competitorProductRepository.findAll({
      page,
      limit,
      search: input.search,
      isActive: input.isActive,
    });

    return {
      data: competitorProducts.map(serializeCompetitorProduct),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class GetCompetitorProductUseCase {
  constructor(
    private readonly deps: { competitorProductRepository: CompetitorProductRepository }
  ) {}

  async execute(input: { competitorProductId: number }) {
    const competitor = await this.deps.competitorProductRepository.findById(
      input.competitorProductId
    );
    if (!competitor) {
      throw new ResourceNotFoundError("CompetitorProduct", input.competitorProductId);
    }
    const references = await this.deps.competitorProductRepository.findReferences(
      input.competitorProductId
    );
    return {
      ...serializeCompetitorProduct(competitor),
      deletable: Object.keys(references).length === 0,
      blockingReferences: references,
    };
  }
}

/** The competitor half of [DeleteProductUseCase] — same rule, same reasons. */
export class DeleteCompetitorProductUseCase {
  constructor(
    private readonly deps: { competitorProductRepository: CompetitorProductRepository }
  ) {}

  async execute(input: { competitorProductId: number }) {
    const outcome =
      await this.deps.competitorProductRepository.deleteIfUnreferenced(
        input.competitorProductId
      );
    if (!outcome.found) {
      throw new ResourceNotFoundError("CompetitorProduct", input.competitorProductId);
    }
    if (!outcome.deleted) {
      throw new ResourceInUseError("CompetitorProduct", outcome.references);
    }
    return { id: input.competitorProductId, deleted: true };
  }
}

export class CreateCompetitorProductUseCase {
  constructor(
    private readonly deps: { competitorProductRepository: CompetitorProductRepository }
  ) {}

  async execute(input: {
    code?: string | null;
    name: string;
    manufacturer: string;
    brand?: string | null;
    countryOfOrigin: string;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt?: string | null;
    isActive?: boolean;
  }) {
    const competitor = await this.deps.competitorProductRepository.create(input);
    return serializeCompetitorProduct(competitor);
  }
}

export class UpdateCompetitorProductUseCase {
  constructor(
    private readonly deps: { competitorProductRepository: CompetitorProductRepository }
  ) {}

  async execute(input: {
    competitorProductId: number;
    code?: string | null;
    name?: string;
    manufacturer?: string;
    brand?: string | null;
    countryOfOrigin?: string;
    price17?: number;
    price18?: number;
    price20?: number;
    brasindiceUpdatedAt?: string | null;
    isActive?: boolean;
  }) {
    const { competitorProductId, ...rest } = input;
    const competitor = await this.deps.competitorProductRepository.update(
      competitorProductId,
      rest
    );
    return serializeCompetitorProduct(competitor);
  }
}

export class GetProductComparisonUseCase {
  constructor(
    private readonly deps: {
      productRepository: ProductRepository;
      productEquivalenceRepository: ProductEquivalenceRepository;
    }
  ) {}

  async execute(input: {
    productId: number;
    sortBy?: ComparisonSortColumn;
    scope: ScopeContext;
    role: string;
    verticalId?: number;
  }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) throw new ResourceNotFoundError("Product", input.productId);

    const verticalIds = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });
    if (!productVisibleInVerticals(product, verticalIds)) {
      throw new ForbiddenError();
    }

    const competitors = await this.deps.productEquivalenceRepository.findLinkedByProduct(
      input.productId
    );

    const rows: ComparisonRow[] = [
      productToComparisonRow(product),
      ...competitors.map(competitorToComparisonRow),
    ];

    return {
      productId: product.id,
      productLabel: product.name,
      rows: sortRowsByPrice(rows, input.sortBy ?? "icms20"),
    };
  }
}

export class ListUnlinkedCompetitorProductsUseCase {
  constructor(
    private readonly deps: {
      productRepository: ProductRepository;
      productEquivalenceRepository: ProductEquivalenceRepository;
    }
  ) {}

  async execute(input: { productId: number }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) throw new ResourceNotFoundError("Product", input.productId);

    const unlinked = await this.deps.productEquivalenceRepository.findUnlinkedByProduct(
      input.productId
    );
    return { data: unlinked.map(serializeCompetitorProduct) };
  }
}

export class LinkCompetitorProductUseCase {
  constructor(
    private readonly deps: {
      productRepository: ProductRepository;
      competitorProductRepository: CompetitorProductRepository;
      productEquivalenceRepository: ProductEquivalenceRepository;
    }
  ) {}

  async execute(input: {
    productId: number;
    competitorProductId: number;
    notes?: string | null;
  }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) throw new ResourceNotFoundError("Product", input.productId);

    const competitor = await this.deps.competitorProductRepository.findById(
      input.competitorProductId
    );
    if (!competitor) {
      throw new ResourceNotFoundError("CompetitorProduct", input.competitorProductId);
    }

    const alreadyLinked = await this.deps.productEquivalenceRepository.exists(
      input.productId,
      input.competitorProductId
    );
    if (alreadyLinked) {
      throw new ValidationError([
        {
          field: "competitorProductId",
          message: "This competitor product is already linked to this product",
        },
      ]);
    }

    await this.deps.productEquivalenceRepository.link(
      input.productId,
      input.competitorProductId,
      input.notes
    );

    return { productId: input.productId, competitorProductId: input.competitorProductId };
  }
}

export class UnlinkCompetitorProductUseCase {
  constructor(
    private readonly deps: { productEquivalenceRepository: ProductEquivalenceRepository }
  ) {}

  async execute(input: { productId: number; competitorProductId: number }) {
    const unlinked = await this.deps.productEquivalenceRepository.unlink(
      input.productId,
      input.competitorProductId
    );
    if (!unlinked) {
      throw new ResourceNotFoundError(
        "ProductEquivalence",
        `${input.productId}:${input.competitorProductId}`
      );
    }
  }
}

export class GetPriceIndexUseCase {
  constructor(
    private readonly deps: {
      productRepository: ProductRepository;
      competitorProductRepository: CompetitorProductRepository;
    }
  ) {}

  async execute(input: {
    sortBy?: ComparisonSortColumn;
    scope: ScopeContext;
    role: string;
    verticalId?: number;
  }) {
    const verticalIds = resolveVerticalIds({
      role: input.role,
      assignedVerticalIds: input.scope.assignedVerticalIds ?? [],
      queryVerticalId: input.verticalId,
    });

    const [products, competitors] = await Promise.all([
      this.deps.productRepository.findAllActive({ verticalIds }),
      this.deps.competitorProductRepository.findAllActive(),
    ]);

    const rows: ComparisonRow[] = [
      ...products.map(productToComparisonRow),
      ...competitors.map(competitorToComparisonRow),
    ];

    return { data: sortRowsByPrice(rows, input.sortBy ?? "icms20") };
  }
}
