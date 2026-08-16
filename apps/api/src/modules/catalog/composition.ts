import { DrizzleBusinessVerticalRepository } from "./infrastructure/repositories/drizzle/drizzle-business-vertical.repository";
import { DrizzleProductRepository } from "./infrastructure/repositories/drizzle/drizzle-product.repository";
import { DrizzleHealthcareProviderRepository } from "./infrastructure/repositories/drizzle/drizzle-healthcare-provider.repository";
import { DrizzleFacilityHealthcareProviderShareRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-healthcare-provider-share.repository";
import { DrizzleFacilityVerticalAccessRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-vertical-access.repository";
import { DrizzleCompetitorProductRepository } from "./infrastructure/repositories/drizzle/drizzle-competitor-product.repository";
import { DrizzleProductEquivalenceRepository } from "./infrastructure/repositories/drizzle/drizzle-product-equivalence.repository";
import { AvatarStorageAdapter } from "../access/infrastructure/avatar-storage/avatar-storage.adapter";
import {
  UploadProductPictureUseCase,
  RemoveProductPictureUseCase,
  DownloadProductPictureUseCase,
} from "./application/use-cases/product-picture.use-cases";
import {
  ListBusinessVerticalsUseCase,
  CreateBusinessVerticalUseCase,
  UpdateBusinessVerticalUseCase,
  ListProductsUseCase,
  GetProductUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
  DeleteCompetitorProductUseCase,
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

/**
 * The same adapter the facility photos and user avatars use. A second storage
 * client would be a second place for the bucket configuration to be wrong.
 */
const productPictureStorage = new AvatarStorageAdapter();

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
  uploadProductPicture: () =>
    new UploadProductPictureUseCase({
      productRepository: catalogRepositories.product,
      storage: productPictureStorage,
    }),
  removeProductPicture: () =>
    new RemoveProductPictureUseCase({
      productRepository: catalogRepositories.product,
      storage: productPictureStorage,
    }),
  downloadProductPicture: () =>
    new DownloadProductPictureUseCase({
      productRepository: catalogRepositories.product,
      storage: productPictureStorage,
    }),
  deleteProduct: () => new DeleteProductUseCase({ productRepository: catalogRepositories.product }),
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
  deleteCompetitorProduct: () =>
    new DeleteCompetitorProductUseCase({
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
