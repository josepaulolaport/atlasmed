import {
  CreateFacilityHealthcareProviderShareUseCase,
  CreateHealthcareProviderUseCase,
  CreateProductUseCase,
  CreateSectorUseCase,
  GetProductUseCase,
  ListFacilityHealthcareProviderSharesUseCase,
  ListHealthcareProvidersUseCase,
  ListProductsUseCase,
  ListSectorsUseCase,
  UpdateHealthcareProviderUseCase,
  UpdateProductUseCase,
  UpdateSectorUseCase
} from './application/use-cases/catalog.use-cases'
import { DrizzleFacilityHealthcareProviderShareRepository } from './infrastructure/repositories/drizzle/drizzle-facility-healthcare-provider-share.repository'
import { DrizzleHealthcareProviderRepository } from './infrastructure/repositories/drizzle/drizzle-healthcare-provider.repository'
import { DrizzleProductRepository } from './infrastructure/repositories/drizzle/drizzle-product.repository'
import { DrizzleSectorRepository } from './infrastructure/repositories/drizzle/drizzle-sector.repository'

export const catalogRepositories = {
  sector: new DrizzleSectorRepository(),
  product: new DrizzleProductRepository(),
  healthcareProvider: new DrizzleHealthcareProviderRepository(),
  facilityShare: new DrizzleFacilityHealthcareProviderShareRepository()
}

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
      healthcareProviderRepository: catalogRepositories.healthcareProvider
    }),
  createHealthcareProvider: () =>
    new CreateHealthcareProviderUseCase({
      healthcareProviderRepository: catalogRepositories.healthcareProvider
    }),
  updateHealthcareProvider: () =>
    new UpdateHealthcareProviderUseCase({
      healthcareProviderRepository: catalogRepositories.healthcareProvider
    }),
  listFacilityShares: () =>
    new ListFacilityHealthcareProviderSharesUseCase({
      shareRepository: catalogRepositories.facilityShare
    }),
  createFacilityShare: () =>
    new CreateFacilityHealthcareProviderShareUseCase({
      shareRepository: catalogRepositories.facilityShare
    })
}
