import { describe, expect, it, mock } from "bun:test";
import { GetProductUseCase, ListProductsUseCase } from "./catalog.use-cases";
import type { ProductRecord, ProductRepository } from "../interfaces/product.repository.interface";

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
    create: mock(),
    update: mock(),
    ...overrides,
  } as ProductRepository;
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
