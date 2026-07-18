import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type { SectorRepository } from "../interfaces/sector.repository.interface";
import type { ProductRecord, ProductRepository } from "../interfaces/product.repository.interface";
import type {
  HealthcareProviderRepository,
  HealthcareProviderType,
} from "../interfaces/healthcare-provider.repository.interface";
import type { FacilityHealthcareProviderShareRepository } from "../interfaces/facility-healthcare-provider-share.repository.interface";
import type {
  CompetitorProductRecord,
  CompetitorProductRepository,
} from "../interfaces/competitor-product.repository.interface";
import type { ProductEquivalenceRepository } from "../interfaces/product-equivalence.repository.interface";

function serializeSector(row: {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeProduct(row: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  commercialCode: string | null;
  productGroup: string | null;
  productClassification: string | null;
  brand: string | null;
  unit: string | null;
  sectorIds: string[];
  pictureUrl: string | null;
  simproCode: string;
  brasindiceCode: string;
  tissCode: string;
  manufacturer: string;
  countryOfOrigin: string;
  price: number;
  price17: number;
  price18: number;
  price20: number;
  brasindiceUpdatedAt: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    commercialCode: row.commercialCode,
    productGroup: row.productGroup,
    productClassification: row.productClassification,
    brand: row.brand,
    unit: row.unit,
    sectorIds: row.sectorIds,
    pictureUrl: row.pictureUrl,
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
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeProvider(row: {
  id: string;
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

export class ListSectorsUseCase {
  constructor(private readonly deps: { sectorRepository: SectorRepository }) {}

  async execute(input: { page?: number; limit?: number; isActive?: boolean }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const { sectors, total } = await this.deps.sectorRepository.findAll({
      page,
      limit,
      isActive: input.isActive,
    });

    return {
      data: sectors.map(serializeSector),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class CreateSectorUseCase {
  constructor(private readonly deps: { sectorRepository: SectorRepository }) {}

  async execute(input: { slug: string; name: string; isActive?: boolean }) {
    const sector = await this.deps.sectorRepository.create(input);
    return serializeSector(sector);
  }
}

export class UpdateSectorUseCase {
  constructor(private readonly deps: { sectorRepository: SectorRepository }) {}

  async execute(input: {
    sectorId: string;
    slug?: string;
    name?: string;
    isActive?: boolean;
  }) {
    const sector = await this.deps.sectorRepository.update(input.sectorId, {
      slug: input.slug,
      name: input.name,
      isActive: input.isActive,
    });
    return serializeSector(sector);
  }
}

export class ListProductsUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: {
    page?: number;
    limit?: number;
    sectorId?: string;
    search?: string;
    isActive?: boolean;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const { products, total } = await this.deps.productRepository.findAll({
      page,
      limit,
      sectorId: input.sectorId,
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

  async execute(input: { productId: string }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) throw new ResourceNotFoundError("Product", input.productId);
    return serializeProduct(product);
  }
}

export class CreateProductUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: {
    code: string;
    name: string;
    sectorIds: string[];
    pictureUrl?: string | null;
    simproCode: string;
    brasindiceCode: string;
    tissCode: string;
    manufacturer: string;
    countryOfOrigin: string;
    price: number;
    price17: number;
    price18: number;
    price20: number;
    brasindiceUpdatedAt: string;
    isActive?: boolean;
  }) {
    const product = await this.deps.productRepository.create(input);
    return serializeProduct(product);
  }
}

export class UpdateProductUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: {
    productId: string;
    code?: string;
    name?: string;
    sectorIds?: string[];
    pictureUrl?: string | null;
    simproCode?: string;
    brasindiceCode?: string;
    tissCode?: string;
    manufacturer?: string;
    countryOfOrigin?: string;
    price?: number;
    price17?: number;
    price18?: number;
    price20?: number;
    brasindiceUpdatedAt?: string;
    isActive?: boolean;
  }) {
    const product = await this.deps.productRepository.update(input.productId, {
      code: input.code,
      name: input.name,
      sectorIds: input.sectorIds,
      pictureUrl: input.pictureUrl,
      simproCode: input.simproCode,
      brasindiceCode: input.brasindiceCode,
      tissCode: input.tissCode,
      manufacturer: input.manufacturer,
      countryOfOrigin: input.countryOfOrigin,
      price: input.price,
      price17: input.price17,
      price18: input.price18,
      price20: input.price20,
      brasindiceUpdatedAt: input.brasindiceUpdatedAt,
      isActive: input.isActive,
    });
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
    providerId: string;
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

export class ListFacilityHealthcareProviderSharesUseCase {
  constructor(
    private readonly deps: {
      shareRepository: FacilityHealthcareProviderShareRepository;
    }
  ) {}

  async execute(input: { facilityId: string; scope: ScopeContext }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);
    const shares = await this.deps.shareRepository.findByFacility(input.facilityId);

    return {
      data: shares.map((share) => ({
        id: share.id,
        facilityId: share.facilityId,
        healthcareProviderId: share.healthcareProviderId,
        sharePercent: share.sharePercent,
        source: share.source,
        healthcareProvider: share.healthcareProvider,
        createdAt: share.createdAt.toISOString(),
        updatedAt: share.updatedAt.toISOString(),
      })),
    };
  }
}

export class CreateFacilityHealthcareProviderShareUseCase {
  constructor(
    private readonly deps: {
      shareRepository: FacilityHealthcareProviderShareRepository;
    }
  ) {}

  async execute(input: {
    facilityId: string;
    healthcareProviderId: string;
    sharePercent: number;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

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
    });

    return {
      id: share.id,
      facilityId: share.facilityId,
      healthcareProviderId: share.healthcareProviderId,
      sharePercent: share.sharePercent,
      source: share.source,
      healthcareProvider: share.healthcareProvider,
      createdAt: share.createdAt.toISOString(),
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ComparisonSortColumn = "icms17" | "icms18" | "icms20";

export interface ComparisonRow {
  id: string;
  label: string;
  manufacturer: string;
  countryOfOrigin: string;
  price17: number;
  price18: number;
  price20: number;
  updatedAt: string;
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

  async execute(input: { competitorProductId: string }) {
    const competitor = await this.deps.competitorProductRepository.findById(
      input.competitorProductId
    );
    if (!competitor) {
      throw new ResourceNotFoundError("CompetitorProduct", input.competitorProductId);
    }
    return serializeCompetitorProduct(competitor);
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
    brasindiceUpdatedAt: string;
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
    competitorProductId: string;
    code?: string | null;
    name?: string;
    manufacturer?: string;
    brand?: string | null;
    countryOfOrigin?: string;
    price17?: number;
    price18?: number;
    price20?: number;
    brasindiceUpdatedAt?: string;
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

  async execute(input: { productId: string; sortBy?: ComparisonSortColumn }) {
    const product = await this.deps.productRepository.findById(input.productId);
    if (!product) throw new ResourceNotFoundError("Product", input.productId);

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

  async execute(input: { productId: string }) {
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
    productId: string;
    competitorProductId: string;
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

  async execute(input: { productId: string; competitorProductId: string }) {
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

  async execute(input: { sortBy?: ComparisonSortColumn }) {
    const [products, competitors] = await Promise.all([
      this.deps.productRepository.findAllActive(),
      this.deps.competitorProductRepository.findAllActive(),
    ]);

    const rows: ComparisonRow[] = [
      ...products.map(productToComparisonRow),
      ...competitors.map(competitorToComparisonRow),
    ];

    return { data: sortRowsByPrice(rows, input.sortBy ?? "icms20") };
  }
}
