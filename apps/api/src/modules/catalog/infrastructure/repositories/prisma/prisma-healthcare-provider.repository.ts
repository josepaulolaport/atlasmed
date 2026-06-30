import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  HealthcareProviderRecord,
  HealthcareProviderRepository,
  HealthcareProviderType,
} from "../../../application/interfaces/healthcare-provider.repository.interface";

function mapProvider(row: {
  id: string;
  name: string;
  type: HealthcareProviderType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): HealthcareProviderRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaHealthcareProviderRepository implements HealthcareProviderRepository {
  async findAll(params: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ providers: HealthcareProviderRecord[]; total: number }> {
    const where = params.isActive === undefined ? {} : { isActive: params.isActive };
    const skip = (params.page - 1) * params.limit;

    const [providers, total] = await Promise.all([
      prisma.healthcareProvider.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: params.limit,
      }),
      prisma.healthcareProvider.count({ where }),
    ]);

    return { providers: providers.map(mapProvider), total };
  }

  async findById(id: string): Promise<HealthcareProviderRecord | null> {
    const provider = await prisma.healthcareProvider.findUnique({ where: { id } });
    return provider ? mapProvider(provider) : null;
  }

  async create(data: {
    name: string;
    type: HealthcareProviderType;
    isActive?: boolean;
  }): Promise<HealthcareProviderRecord> {
    const provider = await prisma.healthcareProvider.create({
      data: {
        name: data.name,
        type: data.type,
        isActive: data.isActive ?? true,
      },
    });
    return mapProvider(provider);
  }

  async update(
    id: string,
    data: { name?: string; type?: HealthcareProviderType; isActive?: boolean }
  ): Promise<HealthcareProviderRecord> {
    const provider = await prisma.healthcareProvider.update({ where: { id }, data });
    return mapProvider(provider);
  }
}
