import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  ProductRecord,
  ProductRepository,
} from "../../../application/interfaces/product.repository.interface";

function mapProduct(row: {
  id: string;
  code: string;
  name: string;
  sectorId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sectorId: row.sectorId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaProductRepository implements ProductRepository {
  async findAll(params: {
    page: number;
    limit: number;
    sectorId?: string;
    isActive?: boolean;
  }): Promise<{ products: ProductRecord[]; total: number }> {
    const where = {
      ...(params.sectorId ? { sectorId: params.sectorId } : {}),
      ...(params.isActive === undefined ? {} : { isActive: params.isActive }),
    };
    const skip = (params.page - 1) * params.limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: params.limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { products: products.map(mapProduct), total };
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const product = await prisma.product.findUnique({ where: { id } });
    return product ? mapProduct(product) : null;
  }

  async create(data: {
    code: string;
    name: string;
    sectorId: string;
    isActive?: boolean;
  }): Promise<ProductRecord> {
    const product = await prisma.product.create({
      data: {
        code: data.code,
        name: data.name,
        sectorId: data.sectorId,
        isActive: data.isActive ?? true,
      },
    });
    return mapProduct(product);
  }

  async update(
    id: string,
    data: { code?: string; name?: string; sectorId?: string; isActive?: boolean }
  ): Promise<ProductRecord> {
    const product = await prisma.product.update({ where: { id }, data });
    return mapProduct(product);
  }
}
