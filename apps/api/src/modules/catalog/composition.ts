import { PrismaSectorRepository } from "./infrastructure/repositories/prisma/prisma-sector.repository";
import { PrismaProductRepository } from "./infrastructure/repositories/prisma/prisma-product.repository";
import { PrismaHealthcareProviderRepository } from "./infrastructure/repositories/prisma/prisma-healthcare-provider.repository";
import { PrismaFacilityHealthcareProviderShareRepository } from "./infrastructure/repositories/prisma/prisma-facility-healthcare-provider-share.repository";
import {
  ListSectorsUseCase,
  CreateSectorUseCase,
  UpdateSectorUseCase,
  ListProductsUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  ListHealthcareProvidersUseCase,
  CreateHealthcareProviderUseCase,
  UpdateHealthcareProviderUseCase,
  ListFacilityHealthcareProviderSharesUseCase,
  CreateFacilityHealthcareProviderShareUseCase,
} from "./application/use-cases/catalog.use-cases";

export const catalogRepositories = {
  sector: new PrismaSectorRepository(),
  product: new PrismaProductRepository(),
  healthcareProvider: new PrismaHealthcareProviderRepository(),
  facilityShare: new PrismaFacilityHealthcareProviderShareRepository(),
};

export const catalogUseCases = {
  listSectors: () => new ListSectorsUseCase({ sectorRepository: catalogRepositories.sector }),
  createSector: () => new CreateSectorUseCase({ sectorRepository: catalogRepositories.sector }),
  updateSector: () => new UpdateSectorUseCase({ sectorRepository: catalogRepositories.sector }),
  listProducts: () => new ListProductsUseCase({ productRepository: catalogRepositories.product }),
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
};
