import { db } from "../../../../../infrastructure/database/db";
import { businessVerticals } from "@atlasmed/database";
import { eq, asc, sql } from "drizzle-orm";
import type {
  BusinessVerticalRecord,
  BusinessVerticalRepository,
} from "../../../application/interfaces/business-vertical.repository.interface";

function mapVertical(row: {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): BusinessVerticalRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleBusinessVerticalRepository implements BusinessVerticalRepository {
  async findAll(params: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ verticals: BusinessVerticalRecord[]; total: number }> {
    const where =
      params.isActive === undefined ? undefined : eq(businessVerticals.isActive, params.isActive);
    const skip = (params.page - 1) * params.limit;

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(businessVerticals)
        .where(where)
        .orderBy(asc(businessVerticals.name))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(businessVerticals).where(where),
    ]);

    return { verticals: rows.map(mapVertical), total: Number(countRows[0]?.count ?? 0) };
  }

  async findById(id: number): Promise<BusinessVerticalRecord | null> {
    const rows = await db.select().from(businessVerticals).where(eq(businessVerticals.id, id));
    return rows[0] ? mapVertical(rows[0]) : null;
  }

  async create(data: {
    code: string;
    name: string;
    isActive?: boolean;
  }): Promise<BusinessVerticalRecord> {
    const [vertical] = await db
      .insert(businessVerticals)
      .values({
        code: data.code,
        name: data.name,
        isActive: data.isActive ?? true,
      })
      .returning();
    return mapVertical(vertical!);
  }

  async update(
    id: number,
    data: { code?: string; name?: string; isActive?: boolean }
  ): Promise<BusinessVerticalRecord> {
    const [vertical] = await db
      .update(businessVerticals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(businessVerticals.id, id))
      .returning();
    return mapVertical(vertical!);
  }
}
