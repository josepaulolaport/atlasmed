import { DrizzleBusinessVerticalRepository } from "./infrastructure/repositories/drizzle/drizzle-business-vertical.repository";
import { DrizzleProductRepository } from "./infrastructure/repositories/drizzle/drizzle-product.repository";
import { DrizzleHealthcareProviderRepository } from "./infrastructure/repositories/drizzle/drizzle-healthcare-provider.repository";
import { DrizzleFacilityHealthcareProviderShareRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-healthcare-provider-share.repository";
import { DrizzleFacilityVerticalAccessRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-vertical-access.repository";
import { DrizzleCompetitorProductRepository } from "./infrastructure/repositories/drizzle/drizzle-competitor-product.repository";
import { DrizzleProductEquivalenceRepository } from "./infrastructure/repositories/drizzle/drizzle-product-equivalence.repository";
import {
  ListBusinessVerticalsUseCase,
  CreateBusinessVerticalUseCase,
  UpdateBusinessVerticalUseCase,
  ListProductsUseCase,
  GetProductUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  ListHealthcareProvidersUseCase,
  CreateHealthcareProviderUseCase,
  UpdateHealthcareProviderUseCase,
  ListFacilityHealthcareProviderSharesUseCase,
  CreateFacilityHealthcareProviderShareUseCase,
  ReplaceFacilityHealthcareProviderSharesUseCase,
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
  businessVertical: new DrizzleBusinessVerticalRepository(),
  product: new DrizzleProductRepository(),
  healthcareProvider: new DrizzleHealthcareProviderRepository(),
  facilityShare: new DrizzleFacilityHealthcareProviderShareRepository(),
  facilityVerticalAccess: new DrizzleFacilityVerticalAccessRepository(),
  competitorProduct: new DrizzleCompetitorProductRepository(),
  productEquivalence: new DrizzleProductEquivalenceRepository(),
};

export const catalogUseCases = {
  listBusinessVerticals: () =>
    new ListBusinessVerticalsUseCase({
      businessVerticalRepository: catalogRepositories.businessVertical,
    }),
  createBusinessVertical: () =>
    new CreateBusinessVerticalUseCase({
      businessVerticalRepository: catalogRepositories.businessVertical,
    }),
  updateBusinessVertical: () =>
    new UpdateBusinessVerticalUseCase({
      businessVerticalRepository: catalogRepositories.businessVertical,
    }),
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
      facilityVerticalAccess: catalogRepositories.facilityVerticalAccess,
    }),
  createFacilityShare: () =>
    new CreateFacilityHealthcareProviderShareUseCase({
      shareRepository: catalogRepositories.facilityShare,
      facilityVerticalAccess: catalogRepositories.facilityVerticalAccess,
    }),
  replaceFacilityShares: () =>
    new ReplaceFacilityHealthcareProviderSharesUseCase({
      shareRepository: catalogRepositories.facilityShare,
      facilityVerticalAccess: catalogRepositories.facilityVerticalAccess,
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
