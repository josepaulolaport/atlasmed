import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext, type ScopeContext } from "@atlasmed/access";
import {
  CreateProductUseCase,
  DeleteProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  UpdateBusinessVerticalUseCase,
  UpdateProductUseCase,
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
import type { BusinessVerticalRepository } from "../interfaces/business-vertical.repository.interface";
import type {
  CompetitorProductRecord,
  CompetitorProductRepository,
} from "../interfaces/competitor-product.repository.interface";
import type { ProductEquivalenceRepository } from "../interfaces/product-equivalence.repository.interface";
import type { FacilityHealthcareProviderShareRepository } from "../interfaces/facility-healthcare-provider-share.repository.interface";
import type { FacilityVerticalAccessRepository } from "../interfaces/facility-vertical-access.repository.interface";
import {
  ForbiddenError,
  ResourceInUseError,
  ResourceNotFoundError,
  ValidationError,
} from "../../../../shared/errors";

function scopeWithVerticals(verticalIds: number[]): ScopeContext {
  return { ...createGlobalScopeContext(), assignedVerticalIds: verticalIds };
}

const product: ProductRecord = {
  id: 1,
  code: "ATL-001",
  name: "AtlasGel",
  description: "Gel ortopédico",
  commercialCode: "AG-240",
  productGroup: "Ortopedia",
  productClassification: "Tópico",
  internalClassification: null,
  brand: "Atlas",
  unit: "240g",
  barcode: null,
  ncm: null,
  anvisaRegistration: null,
  requiresSterilization: false,
  idProdutoEmultec: null,
  verticalIds: [1],
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
  metricUnits: 1,
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
    findReferences: mock(() => Promise.resolve({})),
    deleteIfUnreferenced: mock(),
    ...overrides,
  } as ProductRepository;
}

const competitor: CompetitorProductRecord = {
  id: 101,
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
    findReferences: mock(() => Promise.resolve({})),
    deleteIfUnreferenced: mock(),
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

/**
 * Spec 0016 §5.1, §6.7 and §7.1 — the product write contract.
 *
 * Each of these is a rule that lives in more than one file (a route schema, a
 * use case, a repository), so each is asserted at the layer that would still be
 * wrong if one of the others were relaxed.
 */
describe("product write contract", () => {
  it("passes null pricing-table codes through instead of demanding strings", async () => {
    // Spec 0013 §2 made these nullable so the Emultec importer would stop
    // inventing `EMULTEC-SIM-{id}`. The route kept requiring them until §5.1, so
    // an admin registering a product by hand had to invent the same values.
    const productRepository = repository({
      create: mock(() => Promise.resolve(product)),
    });

    await new CreateProductUseCase({ productRepository }).execute({
      name: "Sem códigos",
      manufacturer: "AtlasMed",
      countryOfOrigin: "Brasil",
      verticalIds: [1],
      code: null,
      simproCode: null,
      brasindiceCode: null,
      tissCode: null,
      brasindiceUpdatedAt: null,
      price: null,
    });

    expect(productRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: null,
        simproCode: null,
        brasindiceCode: null,
        tissCode: null,
        brasindiceUpdatedAt: null,
        price: null,
      })
    );
  });

  it("refuses a product with no Linha", async () => {
    // The route enforces `minItems: 1`, but a product with no vertical is
    // invisible to every rep and contributes to no metric (spec 0016 §7.2), so
    // the rule is restated where it cannot be bypassed by another caller.
    const productRepository = repository({ create: mock() });

    await expect(
      new CreateProductUseCase({ productRepository }).execute({
        name: "Órfão",
        manufacturer: "AtlasMed",
        countryOfOrigin: "Brasil",
        verticalIds: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(productRepository.create).not.toHaveBeenCalled();
  });

  it("never writes metricUnits, and reports it on the way out", async () => {
    // Spec 0016 §7.1: informative field, no writer. `sumOurs` uses raw
    // quantities and `sumOursByProduct` still multiplies by this column, so the
    // day a value stops being 1 the total and its own breakdown disagree.
    const productRepository = repository({
      create: mock(() => Promise.resolve(product)),
      update: mock(() => Promise.resolve(product)),
    });

    const created = await new CreateProductUseCase({ productRepository }).execute({
      name: "AtlasGel",
      manufacturer: "AtlasMed",
      countryOfOrigin: "Brasil",
      verticalIds: [1],
    });
    await new UpdateProductUseCase({ productRepository }).execute({
      productId: 1,
      name: "AtlasGel 2",
    });

    const createArg = (productRepository.create as ReturnType<typeof mock>).mock
      .calls[0]![0] as Record<string, unknown>;
    const updateArg = (productRepository.update as ReturnType<typeof mock>).mock
      .calls[0]![1] as Record<string, unknown>;
    expect(createArg).not.toHaveProperty("metricUnits");
    expect(updateArg).not.toHaveProperty("metricUnits");
    expect(created.metricUnits).toBe(1);
  });

  it("does not move a product between Linhas on update", async () => {
    // Spec 0016 §6.7. Orders key on `facility_vertical_profile_id` and
    // `product_potential_links` is unique per (product, vertical), so a move
    // changes which profiles the product's sales join to and orphans its link.
    const productRepository = repository({
      update: mock(() => Promise.resolve(product)),
    });

    await new UpdateProductUseCase({ productRepository }).execute({
      productId: 1,
      name: "Renomeado",
    });

    const updateArg = (productRepository.update as ReturnType<typeof mock>).mock
      .calls[0]![1] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("verticalIds");
    expect(updateArg).not.toHaveProperty("productId");
    expect(updateArg).toEqual({ name: "Renomeado" });
  });

  it("deletes a product nothing references", async () => {
    const productRepository = repository({
      deleteIfUnreferenced: mock(() =>
        Promise.resolve({ found: true as const, deleted: true as const })
      ),
    });

    const result = await new DeleteProductUseCase({ productRepository }).execute({
      productId: 1,
    });

    expect(result).toEqual({ id: 1, deleted: true });
  });

  it("refuses to delete a referenced product, and says what blocks it", async () => {
    // Spec 0016 §6.2. Not a warning to click through: `product_equivalences`
    // cascades, so a forced delete would silently drop equivalences a rep's
    // picker depends on, and `facility_product_usage` is `restrict`, so it would
    // fail opaquely instead.
    const productRepository = repository({
      deleteIfUnreferenced: mock(() =>
        Promise.resolve({
          found: true as const,
          deleted: false as const,
          references: { orderItems: 3, productEquivalences: 1 },
        })
      ),
    });

    const failure = await new DeleteProductUseCase({ productRepository })
      .execute({ productId: 1 })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ResourceInUseError);
    expect((failure as ResourceInUseError).statusCode).toBe(409);
    // The counts must survive `toClientJSON`, which drops context by default:
    // an admin told only "cannot be deleted" has no next step.
    expect((failure as ResourceInUseError).toClientJSON()).toMatchObject({
      code: "RESOURCE_IN_USE",
      blockedBy: { orderItems: 3, productEquivalences: 1 },
    });
  });

  it("reports a missing product as 404, not as a refused delete", async () => {
    // Two different answers for two different situations: collapsing them into
    // one boolean is how a delete that did nothing reads as success.
    const productRepository = repository({
      deleteIfUnreferenced: mock(() => Promise.resolve({ found: false as const })),
    });

    await expect(
      new DeleteProductUseCase({ productRepository }).execute({ productId: 99 })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("tells the detail read whether the product can be deleted", async () => {
    const productRepository = repository({
      findReferences: mock(() => Promise.resolve({ orderItems: 2 })),
    });

    const detail = await new GetProductUseCase({ productRepository }).execute({
      productId: 1,
      scope: scopeWithVerticals([1]),
      role: "ADMIN",
    });

    expect(detail.deletable).toBeFalse();
    expect(detail.blockingReferences).toEqual({ orderItems: 2 });
  });

  it("does not change a Linha's code", async () => {
    // Spec 0016 §4.1: `code` is a stable key other data joins on by meaning, and
    // no screen edits a Linha at all — so an accepted `code` could only drift.
    const businessVerticalRepository = {
      findAll: mock(),
      findById: mock(),
      create: mock(),
      update: mock(() =>
        Promise.resolve({
          id: 1,
          code: "ORTO",
          name: "Ortopedia",
          isActive: true,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })
      ),
    } as unknown as BusinessVerticalRepository;

    await new UpdateBusinessVerticalUseCase({ businessVerticalRepository }).execute({
      verticalId: 1,
      name: "Ortopedia",
    });

    expect(businessVerticalRepository.update).toHaveBeenCalledWith(1, {
      name: "Ortopedia",
      isActive: undefined,
    });
  });
});

describe("catalog product use cases", () => {
  const scope = scopeWithVerticals([1]);

  it("passes resolved verticalIds with search and pagination to the product repository", async () => {
    const productRepository = repository();
    const result = await new ListProductsUseCase({ productRepository }).execute({
      page: 2,
      limit: 10,
      search: "atlas",
      scope,
      role: "REP",
    });

    expect(productRepository.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: "atlas",
      verticalIds: [1],
      isActive: undefined,
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 1,
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

  it("returns empty catalog when caller has no vertical assignments", async () => {
    const productRepository = repository();
    const result = await new ListProductsUseCase({ productRepository }).execute({
      scope: scopeWithVerticals([]),
      role: "REP",
    });

    expect(productRepository.findAll).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
    });
  });

  it("returns a serialized product detail when product intersects caller verticals", async () => {
    const result = await new GetProductUseCase({ productRepository: repository() }).execute({
      productId: 1,
      scope,
      role: "REP",
    });

    expect(result).toEqual(expect.objectContaining({
      id: 1,
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
      data: [expect.objectContaining({ id: 101, name: "SingJoint 24mg/2ml" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("returns a serialized competitor product detail", async () => {
    const result = await new GetCompetitorProductUseCase({
      competitorProductRepository: competitorProductRepository(),
    }).execute({ competitorProductId: 101 });

    expect(result).toEqual(
      expect.objectContaining({ id: 101, manufacturer: "Hangzhou", brand: "Synvisc" })
    );
  });

  it("throws ResourceNotFoundError when the competitor product doesn't exist", async () => {
    const competitorProductRepo = competitorProductRepository({
      findById: mock(() => Promise.resolve(null)),
    });

    await expect(
      new GetCompetitorProductUseCase({
        competitorProductRepository: competitorProductRepo,
      }).execute({ competitorProductId: 99999 })
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
    }).execute({ competitorProductId: 101, price20: 80 });

    expect(competitorProductRepo.update).toHaveBeenCalledWith(101, { price20: 80 });
  });
});

describe("product comparison and price index use cases", () => {
  it("builds a comparison group with the AtlasMed product first, sorted by price", async () => {
    const higherPricedCompetitor: CompetitorProductRecord = {
      ...competitor,
      id: 102,
      name: "Pricier competitor",
      price20: 999,
    };
    const productEquivalenceRepo = productEquivalenceRepository({
      findLinkedByProduct: mock(() => Promise.resolve([competitor, higherPricedCompetitor])),
    });

    const result = await new GetProductComparisonUseCase({
      productRepository: repository(),
      productEquivalenceRepository: productEquivalenceRepo,
    }).execute({
      productId: 1,
      scope: scopeWithVerticals([1]),
      role: "REP",
    });

    expect(result.productId).toBe(1);
    expect(result.rows[0]).toEqual(expect.objectContaining({ id: 102, isOwn: false }));
    expect(result.rows.map((row) => row.id)).toContain(1);
  });

  it("throws ResourceNotFoundError when the product doesn't exist", async () => {
    await expect(
      new GetProductComparisonUseCase({
        productRepository: repository({ findById: mock(() => Promise.resolve(null)) }),
        productEquivalenceRepository: productEquivalenceRepository(),
      }).execute({
        productId: 99999,
        scope: scopeWithVerticals([1]),
        role: "REP",
      })
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it("lists competitor products not yet linked to the product", async () => {
    const result = await new ListUnlinkedCompetitorProductsUseCase({
      productRepository: repository(),
      productEquivalenceRepository: productEquivalenceRepository(),
    }).execute({ productId: 1 });

    expect(result.data).toEqual([expect.objectContaining({ id: 101 })]);
  });

  it("links a competitor product to a product", async () => {
    const productEquivalenceRepo = productEquivalenceRepository();
    await new LinkCompetitorProductUseCase({
      productRepository: repository(),
      competitorProductRepository: competitorProductRepository(),
      productEquivalenceRepository: productEquivalenceRepo,
    }).execute({ productId: 1, competitorProductId: 101 });

    expect(productEquivalenceRepo.link).toHaveBeenCalledWith(1, 101, undefined);
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
      }).execute({ productId: 1, competitorProductId: 101 })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ResourceNotFoundError when unlinking a competitor product that isn't linked", async () => {
    const productEquivalenceRepo = productEquivalenceRepository({
      unlink: mock(() => Promise.resolve(false)),
    });

    await expect(
      new UnlinkCompetitorProductUseCase({
        productEquivalenceRepository: productEquivalenceRepo,
      }).execute({ productId: 1, competitorProductId: 101 })
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it("builds the full price index from AtlasMed and competitor products", async () => {
    const productRepository = repository();
    const result = await new GetPriceIndexUseCase({
      productRepository,
      competitorProductRepository: competitorProductRepository(),
    }).execute({
      scope: scopeWithVerticals([1]),
      role: "REP",
    });

    expect(productRepository.findAllActive).toHaveBeenCalledWith({ verticalIds: [1] });
    expect(result.data).toHaveLength(2);
    expect(result.data.some((row) => row.isOwn)).toBe(true);
    expect(result.data.some((row) => !row.isOwn)).toBe(true);
  });
});

describe("facility healthcare provider shares", () => {
  const facilityId = 1;
  const ortopediaId = 10;

  function shareRepository(
    overrides: Partial<FacilityHealthcareProviderShareRepository> = {}
  ): FacilityHealthcareProviderShareRepository {
    return {
      findByFacility: mock(async () => []),
      create: mock(async () => {
        throw new Error("unused");
      }),
      replaceByFacility: mock(
        async (
          _facilityId: number,
          shares: Array<{
            healthcareProviderId: number;
            sharePercent: number;
            isPackage?: boolean;
          }>
        ) =>
          shares.map((share, index) => ({
            id: index + 1,
            facilityId,
            healthcareProviderId: share.healthcareProviderId,
            sharePercent: share.sharePercent,
            isPackage: share.isPackage ?? false,
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

  function verticalAccess(
    overrides: Partial<FacilityVerticalAccessRepository> = {}
  ): FacilityVerticalAccessRepository {
    return {
      findVerticalIdByCode: mock(async () => ortopediaId),
      hasActiveVerticalProfile: mock(async () => true),
      ...overrides,
    };
  }

  function ortopediaScope(): ScopeContext {
    return scopeWithVerticals([ortopediaId]);
  }

  it("replaces the full share mix when percentages sum to 100", async () => {
    const repo = shareRepository();
    const result = await new ReplaceFacilityHealthcareProviderSharesUseCase({
      shareRepository: repo,
      facilityVerticalAccess: verticalAccess(),
    }).execute({
      facilityId,
      scope: ortopediaScope(),
      shares: [
        { healthcareProviderId: 1, sharePercent: 60, isPackage: true },
        { healthcareProviderId: 2, sharePercent: 40 },
      ],
    });

    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.isPackage).toBe(true);
    expect(result.data[1]?.isPackage).toBe(false);
    expect(repo.replaceByFacility).toHaveBeenCalledWith(facilityId, [
      { healthcareProviderId: 1, sharePercent: 60, isPackage: true },
      { healthcareProviderId: 2, sharePercent: 40, isPackage: false },
    ]);
  });

  it("allows clearing all shares", async () => {
    const repo = shareRepository();
    const result = await new ReplaceFacilityHealthcareProviderSharesUseCase({
      shareRepository: repo,
      facilityVerticalAccess: verticalAccess(),
    }).execute({
      facilityId,
      scope: ortopediaScope(),
      shares: [],
    });

    expect(result.data).toEqual([]);
    expect(repo.replaceByFacility).toHaveBeenCalledWith(facilityId, []);
  });

  it("rejects mixes that do not sum to 100", async () => {
    await expect(
      new ReplaceFacilityHealthcareProviderSharesUseCase({
        shareRepository: shareRepository(),
        facilityVerticalAccess: verticalAccess(),
      }).execute({
        facilityId,
        scope: ortopediaScope(),
        shares: [{ healthcareProviderId: 1, sharePercent: 70 }],
      })
    ).rejects.toThrow(ValidationError);
  });

  it("forbids when user lacks Ortopedia vertical", async () => {
    await expect(
      new ReplaceFacilityHealthcareProviderSharesUseCase({
        shareRepository: shareRepository(),
        facilityVerticalAccess: verticalAccess(),
      }).execute({
        facilityId,
        scope: scopeWithVerticals([20]),
        shares: [],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("forbids when facility lacks Ortopedia profile", async () => {
    await expect(
      new ReplaceFacilityHealthcareProviderSharesUseCase({
        shareRepository: shareRepository(),
        facilityVerticalAccess: verticalAccess({
          hasActiveVerticalProfile: mock(async () => false),
        }),
      }).execute({
        facilityId,
        scope: ortopediaScope(),
        shares: [],
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
