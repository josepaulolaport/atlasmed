import { db } from "../../../../../infrastructure/database/db";
import { sectors } from "@atlasmed/database";
import { eq, asc, sql } from "drizzle-orm";
import type {
  SectorRecord,
  SectorRepository,
} from "../../../application/interfaces/sector.repository.interface";

function mapSector(row: {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SectorRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaSectorRepository implements SectorRepository {
  async findAll(params: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ sectors: SectorRecord[]; total: number }> {
    const where =
      params.isActive === undefined ? undefined : eq(sectors.isActive, params.isActive);
    const skip = (params.page - 1) * params.limit;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(sectors)
        .where(where)
        .orderBy(asc(sectors.name))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(sectors).where(where),
    ]);

    return { sectors: rows.map(mapSector), total: Number(count) };
  }

  async findById(id: string): Promise<SectorRecord | null> {
    const rows = await db.select().from(sectors).where(eq(sectors.id, id));
    return rows[0] ? mapSector(rows[0]) : null;
  }

  async create(data: {
    slug: string;
    name: string;
    isActive?: boolean;
  }): Promise<SectorRecord> {
    const [sector] = await db
      .insert(sectors)
      .values({
        slug: data.slug,
        name: data.name,
        isActive: data.isActive ?? true,
      })
      .returning();
    return mapSector(sector);
  }

  async update(
    id: string,
    data: { slug?: string; name?: string; isActive?: boolean }
  ): Promise<SectorRecord> {
    const [sector] = await db
      .update(sectors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sectors.id, id))
      .returning();
    return mapSector(sector);
  }
}
