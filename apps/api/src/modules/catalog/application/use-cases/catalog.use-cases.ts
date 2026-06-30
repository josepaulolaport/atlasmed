import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import { ValidationError } from "../../../../shared/errors";
import type { SectorRepository } from "../interfaces/sector.repository.interface";
import type { ProductRepository } from "../interfaces/product.repository.interface";
import type {
  HealthcareProviderRepository,
  HealthcareProviderType,
} from "../interfaces/healthcare-provider.repository.interface";
import type { FacilityHealthcareProviderShareRepository } from "../interfaces/facility-healthcare-provider-share.repository.interface";

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
  sectorId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sectorId: row.sectorId,
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
    isActive?: boolean;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const { products, total } = await this.deps.productRepository.findAll({
      page,
      limit,
      sectorId: input.sectorId,
      isActive: input.isActive,
    });

    return {
      data: products.map(serializeProduct),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export class CreateProductUseCase {
  constructor(private readonly deps: { productRepository: ProductRepository }) {}

  async execute(input: {
    code: string;
    name: string;
    sectorId: string;
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
    sectorId?: string;
    isActive?: boolean;
  }) {
    const product = await this.deps.productRepository.update(input.productId, {
      code: input.code,
      name: input.name,
      sectorId: input.sectorId,
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
