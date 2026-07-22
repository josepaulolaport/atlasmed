import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import {
  GetProductUseCase,
  ListProductsUseCase,
  ListCompetitorProductsUseCase,
  GetCompetitorProductUseCase,
  CreateCompetitorProductUseCase,
  UpdateCompetitorProductUseCase,
  GetProductComparisonUseCase,
  ListUnlinkedCompetitorProductsUseCase,
  LinkCompetitorProductUseCase,
  UnlinkCompetitorProductUseCase,
  GetPriceIndexUseCase,
  ReplaceFacilityHealthcareProviderSharesUseCase,
} from "./catalog.use-cases";
import type { ProductRecord, ProductRepository } from "../interfaces/product.repository.interface";
import type {
  CompetitorProductRecord,
  CompetitorProductRepository,
} from "../interfaces/competitor-product.repository.interface";
import type { ProductEquivalenceRepository } from "../interfaces/product-equivalence.repository.interface";
import type { FacilityHealthcareProviderShareRepository } from "../interfaces/facility-healthcare-provider-share.repository.interface";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";

const product: ProductRecord = {
  id: "product-1",
  code: "ATL-001",
  name: "AtlasGel",
  description: "Gel ortopédico",
  commercialCode: "AG-240",
  productGroup: "Ortopedia",
  productClassification: "Tópico",
  brand: "Atlas",
  unit: "240g",
  sectorIds: ["sector-1"],
  pictureUrl: "https://cdn.example.com/atlas-gel.png",
  simproCode: "SIM-1",
  brasindiceCode: "BRA-1",
  tissCode: "TISS-1",
  manufacturer: "AtlasMed",
  countryOfOrigin: "Brasil",
  price: 89.9,
  price17: 90,
  price18: 91,
  price20: 92,
  brasindiceUpdatedAt: "2026-01-01",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function repository(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    findAll: mock(() => Promise.resolve({ products: [product], total: 1 })),
    findById: mock(() => Promise.resolve(product)),
    findAllActive: mock(() => Promise.resolve([product])),
    create: mock(),
    update: mock(),
    ...overrides,
  } as ProductRepository;
}

const competitor: CompetitorProductRecord = {
  id: "competitor-1",
  code: "COMP-001",
  name: "SingJoint 24mg/2ml",
  manufacturer: "Hangzhou",
  brand: "Synvisc",
  countryOfOrigin: "China",
  price17: 70,
  price18: 71,
  price20: 72,
  brasindiceUpdatedAt: "2026-01-01",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

function competitorProductRepository(
  overrides: Partial<CompetitorProductRepository> = {}
): CompetitorProductRepository {
  return {
    findAll: mock(() => Promise.resolve({ competitorProducts: [competitor], total: 1 })),
    findById: mock(() => Promise.resolve(competitor)),
    findAllActive: mock(() => Promise.resolve([competitor])),
    create: mock(() => Promise.resolve(competitor)),
    update: mock(() => Promise.resolve(competitor)),
    ...overrides,
  } as CompetitorProductRepository;
}

function productEquivalenceRepository(
  overrides: Partial<ProductEquivalenceRepository> = {}
): ProductEquivalenceRepository {
  return {
    findLinkedByProduct: mock(() => Promise.resolve([competitor])),
    findUnlinkedByProduct: mock(() => Promise.resolve([competitor])),
    exists: mock(() => Promise.resolve(false)),
    link: mock(() => Promise.resolve()),
    unlink: mock(() => Promise.resolve(true)),
    ...overrides,
  } as ProductEquivalenceRepository;
}

describe("catalog product use cases", () => {
  it("passes search and pagination to the product repository and maps mobile catalog fields", async () => {
    const productRepository = repository();
    const result = await new ListProductsUseCase({ productRepository }).execute({
      page: 2,
      limit: 10,
      search: "atlas",
    });

    expect(productRepository.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: "atlas",
      sectorId: undefined,
      isActive: undefined,
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: "product-1",
          code: "ATL-001",
          description: "Gel ortopédico",
          commercialCode: "AG-240",
          productGroup: "Ortopedia",
          unit: "240g",
          price: 89.9,
          price17: 90,
          price18: 91,
          price20: 92,
          pictureUrl: "https://cdn.example.com/atlas-gel.png",
          isActive: true,
        }),
      ],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it("returns a serialized product detail", async () => {
    const result = await new GetProductUseCase({ productRepository: repository() }).execute({
      productId: "product-1",
    });

    expect(result).toEqual(expect.objectContaining({
      id: "product-1",
      name: "AtlasGel",
      brand: "Atlas",
      productClassification: "Tópico",
      brasindiceUpdatedAt: "2026-01-01",
    }));
  });
});

describe("competitor product use cases", () => {
  it("lists competitor products with pagination and search", async () => {
    const competitorProductRepo = competitorProductRepository();
    const result = await new ListCompetitorProductsUseCase({
      competitorProductRepository: competitorProductRepo,
    }).execute({ page: 1, limit: 20, search: "sing" });

    expect(competitorProductRepo.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      search: "sing",
      isActive: undefined,
    });
    expect(result).toEqual({
      data: [expect.objectContaining({ id: "competitor-1", name: "SingJoint 24mg/2ml" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("returns a serialized competitor product detail", async () => {
    const result = await new GetCompetitorProductUseCase({
      competitorProductRepository: competitorProductRepository(),
    }).execute({ competitorProductId: "competitor-1" });

    expect(result).toEqual(
      expect.objectContaining({ id: "competitor-1", manufacturer: "Hangzhou", brand: "Synvisc" })
    );
  });

  it("throws ResourceNotFoundError when the competitor product doesn't exist", async () => {
    const competitorProductRepo = competitorProductRepository({
      findById: mock(() => Promise.resolve(null)),
    });

    await expect(
      new GetCompetitorProductUseCase({
        competitorProductRepository: competitorProductRepo,
      }).execute({ competitorProductId: "missing" })
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it("creates a competitor product", async () => {
    const competitorProductRepo = competitorProductRepository();
    await new CreateCompetitorProductUseCase({
      competitorProductRepository: competitorProductRepo,
    }).execute({
      name: "SingJoint 24mg/2ml",
      manufacturer: "Hangzhou",
      countryOfOrigin: "China",
      price17: 70,
      price18: 71,
      price20: 72,
      brasindiceUpdatedAt: "2026-01-01",
    });

    expect(competitorProductRepo.create).toHaveBeenCalledTimes(1);
  });

  it("updates a competitor product", async () => {
    const competitorProductRepo = competitorProductRepository();
    await new UpdateCompetitorProductUseCase({
      competitorProductRepository: competitorProductRepo,
    }).execute({ competitorProductId: "competitor-1", price20: 80 });

    expect(competitorProductRepo.update).toHaveBeenCalledWith("competitor-1", { price20: 80 });
  });
});

describe("product comparison and price index use cases", () => {
  it("builds a comparison group with the AtlasMed product first, sorted by price", async () => {
    const higherPricedCompetitor: CompetitorProductRecord = {
      ...competitor,
      id: "competitor-2",
      name: "Pricier competitor",
      price20: 999,
    };
    const productEquivalenceRepo = productEquivalenceRepository({
      findLinkedByProduct: mock(() => Promise.resolve([competitor, higherPricedCompetitor])),
    });

    const result = await new GetProductComparisonUseCase({
      productRepository: repository(),
      productEquivalenceRepository: productEquivalenceRepo,
    }).execute({ productId: "product-1" });

    expect(result.productId).toBe("product-1");
    expect(result.rows[0]).toEqual(expect.objectContaining({ id: "competitor-2", isOwn: false }));
    expect(result.rows.map((row) => row.id)).toContain("product-1");
  });

  it("throws ResourceNotFoundError when the product doesn't exist", async () => {
    await expect(
      new GetProductComparisonUseCase({
        productRepository: repository({ findById: mock(() => Promise.resolve(null)) }),
        productEquivalenceRepository: productEquivalenceRepository(),
      }).execute({ productId: "missing" })
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it("lists competitor products not yet linked to the product", async () => {
    const result = await new ListUnlinkedCompetitorProductsUseCase({
      productRepository: repository(),
      productEquivalenceRepository: productEquivalenceRepository(),
    }).execute({ productId: "product-1" });

    expect(result.data).toEqual([expect.objectContaining({ id: "competitor-1" })]);
  });

  it("links a competitor product to a product", async () => {
    const productEquivalenceRepo = productEquivalenceRepository();
    await new LinkCompetitorProductUseCase({
      productRepository: repository(),
      competitorProductRepository: competitorProductRepository(),
      productEquivalenceRepository: productEquivalenceRepo,
    }).execute({ productId: "product-1", competitorProductId: "competitor-1" });

    expect(productEquivalenceRepo.link).toHaveBeenCalledWith("product-1", "competitor-1", undefined);
  });

  it("rejects linking a competitor product that is already linked", async () => {
    const productEquivalenceRepo = productEquivalenceRepository({
      exists: mock(() => Promise.resolve(true)),
    });

    await expect(
      new LinkCompetitorProductUseCase({
        productRepository: repository(),
        competitorProductRepository: competitorProductRepository(),
        productEquivalenceRepository: productEquivalenceRepo,
      }).execute({ productId: "product-1", competitorProductId: "competitor-1" })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ResourceNotFoundError when unlinking a competitor product that isn't linked", async () => {
    const productEquivalenceRepo = productEquivalenceRepository({
      unlink: mock(() => Promise.resolve(false)),
    });

    await expect(
      new UnlinkCompetitorProductUseCase({
        productEquivalenceRepository: productEquivalenceRepo,
      }).execute({ productId: "product-1", competitorProductId: "competitor-1" })
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it("builds the full price index from AtlasMed and competitor products", async () => {
    const result = await new GetPriceIndexUseCase({
      productRepository: repository(),
      competitorProductRepository: competitorProductRepository(),
    }).execute({});

    expect(result.data).toHaveLength(2);
    expect(result.data.some((row) => row.isOwn)).toBe(true);
    expect(result.data.some((row) => !row.isOwn)).toBe(true);
  });
});

describe("facility healthcare provider shares", () => {
  const facilityId = "facility-1";

  function shareRepository(
    overrides: Partial<FacilityHealthcareProviderShareRepository> = {}
  ): FacilityHealthcareProviderShareRepository {
    return {
      findByFacility: mock(async () => []),
      create: mock(async () => {
        throw new Error("unused");
      }),
      replaceByFacility: mock(async (_facilityId, shares) =>
        shares.map((share, index) => ({
          id: `share-${index}`,
          facilityId,
          healthcareProviderId: share.healthcareProviderId,
          sharePercent: share.sharePercent,
          source: "MANUAL" as const,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          healthcareProvider: {
            id: share.healthcareProviderId,
            name: `Provider ${index}`,
            type: "PRIVATE",
          },
        }))
      ),
      sumSharePercentForFacility: mock(async () => 0),
      ...overrides,
    };
  }

  it("replaces the full share mix when percentages sum to 100", async () => {
    const repo = shareRepository();
    const result = await new ReplaceFacilityHealthcareProviderSharesUseCase({
      shareRepository: repo,
    }).execute({
      facilityId,
      scope: createGlobalScopeContext(),
      shares: [
        { healthcareProviderId: "hp-1", sharePercent: 60 },
        { healthcareProviderId: "hp-2", sharePercent: 40 },
      ],
    });

    expect(result.data).toHaveLength(2);
    expect(repo.replaceByFacility).toHaveBeenCalledWith(facilityId, [
      { healthcareProviderId: "hp-1", sharePercent: 60 },
      { healthcareProviderId: "hp-2", sharePercent: 40 },
    ]);
  });

  it("allows clearing all shares", async () => {
    const repo = shareRepository();
    const result = await new ReplaceFacilityHealthcareProviderSharesUseCase({
      shareRepository: repo,
    }).execute({
      facilityId,
      scope: createGlobalScopeContext(),
      shares: [],
    });

    expect(result.data).toEqual([]);
    expect(repo.replaceByFacility).toHaveBeenCalledWith(facilityId, []);
  });

  it("rejects mixes that do not sum to 100", async () => {
    await expect(
      new ReplaceFacilityHealthcareProviderSharesUseCase({
        shareRepository: shareRepository(),
      }).execute({
        facilityId,
        scope: createGlobalScopeContext(),
        shares: [{ healthcareProviderId: "hp-1", sharePercent: 70 }],
      })
    ).rejects.toThrow(ValidationError);
  });
});
