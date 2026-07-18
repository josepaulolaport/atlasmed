import { DrizzleSectorRepository } from "./infrastructure/repositories/drizzle/drizzle-sector.repository";
import { DrizzleProductRepository } from "./infrastructure/repositories/drizzle/drizzle-product.repository";
import { DrizzleHealthcareProviderRepository } from "./infrastructure/repositories/drizzle/drizzle-healthcare-provider.repository";
import { DrizzleFacilityHealthcareProviderShareRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-healthcare-provider-share.repository";
import { DrizzleCompetitorProductRepository } from "./infrastructure/repositories/drizzle/drizzle-competitor-product.repository";
import { DrizzleProductEquivalenceRepository } from "./infrastructure/repositories/drizzle/drizzle-product-equivalence.repository";
import {
  ListSectorsUseCase,
  CreateSectorUseCase,
  UpdateSectorUseCase,
  ListProductsUseCase,
  GetProductUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  ListHealthcareProvidersUseCase,
  CreateHealthcareProviderUseCase,
  UpdateHealthcareProviderUseCase,
  ListFacilityHealthcareProviderSharesUseCase,
  CreateFacilityHealthcareProviderShareUseCase,
  ListCompetitorProductsUseCase,
  GetCompetitorProductUseCase,
  CreateCompetitorProductUseCase,
  UpdateCompetitorProductUseCase,
  GetProductComparisonUseCase,
  ListUnlinkedCompetitorProductsUseCase,
  LinkCompetitorProductUseCase,
  UnlinkCompetitorProductUseCase,
  GetPriceIndexUseCase,
} from "./application/use-cases/catalog.use-cases";

export const catalogRepositories = {
  sector: new DrizzleSectorRepository(),
  product: new DrizzleProductRepository(),
  healthcareProvider: new DrizzleHealthcareProviderRepository(),
  facilityShare: new DrizzleFacilityHealthcareProviderShareRepository(),
  competitorProduct: new DrizzleCompetitorProductRepository(),
  productEquivalence: new DrizzleProductEquivalenceRepository(),
};

export const catalogUseCases = {
  listSectors: () => new ListSectorsUseCase({ sectorRepository: catalogRepositories.sector }),
  createSector: () => new CreateSectorUseCase({ sectorRepository: catalogRepositories.sector }),
  updateSector: () => new UpdateSectorUseCase({ sectorRepository: catalogRepositories.sector }),
  listProducts: () => new ListProductsUseCase({ productRepository: catalogRepositories.product }),
  getProduct: () => new GetProductUseCase({ productRepository: catalogRepositories.product }),
  createProduct: () => new CreateProductUseCase({ productRepository: catalogRepositories.product }),
  updateProduct: () => new UpdateProductUseCase({ productRepository: catalogRepositories.product }),
  listHealthcareProviders: () =>
    new ListHealthcareProvidersUseCase({
      healthcareProviderRepository: catalogRepositories.healthcareProvider,
    }),
  createHealthcareProvider: () =>
    new CreateHealthcareProviderUseCase({
      healthcareProviderRepository: catalogRepositories.healthcareProvider,
    }),
  updateHealthcareProvider: () =>
    new UpdateHealthcareProviderUseCase({
      healthcareProviderRepository: catalogRepositories.healthcareProvider,
    }),
  listFacilityShares: () =>
    new ListFacilityHealthcareProviderSharesUseCase({
      shareRepository: catalogRepositories.facilityShare,
    }),
  createFacilityShare: () =>
    new CreateFacilityHealthcareProviderShareUseCase({
      shareRepository: catalogRepositories.facilityShare,
    }),
  listCompetitorProducts: () =>
    new ListCompetitorProductsUseCase({
      competitorProductRepository: catalogRepositories.competitorProduct,
    }),
  getCompetitorProduct: () =>
    new GetCompetitorProductUseCase({
      competitorProductRepository: catalogRepositories.competitorProduct,
    }),
  createCompetitorProduct: () =>
    new CreateCompetitorProductUseCase({
      competitorProductRepository: catalogRepositories.competitorProduct,
    }),
  updateCompetitorProduct: () =>
    new UpdateCompetitorProductUseCase({
      competitorProductRepository: catalogRepositories.competitorProduct,
    }),
  getProductComparison: () =>
    new GetProductComparisonUseCase({
      productRepository: catalogRepositories.product,
      productEquivalenceRepository: catalogRepositories.productEquivalence,
    }),
  listUnlinkedCompetitorProducts: () =>
    new ListUnlinkedCompetitorProductsUseCase({
      productRepository: catalogRepositories.product,
      productEquivalenceRepository: catalogRepositories.productEquivalence,
    }),
  linkCompetitorProduct: () =>
    new LinkCompetitorProductUseCase({
      productRepository: catalogRepositories.product,
      competitorProductRepository: catalogRepositories.competitorProduct,
      productEquivalenceRepository: catalogRepositories.productEquivalence,
    }),
  unlinkCompetitorProduct: () =>
    new UnlinkCompetitorProductUseCase({
      productEquivalenceRepository: catalogRepositories.productEquivalence,
    }),
  getPriceIndex: () =>
    new GetPriceIndexUseCase({
      productRepository: catalogRepositories.product,
      competitorProductRepository: catalogRepositories.competitorProduct,
    }),
};
