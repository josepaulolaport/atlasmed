import { db } from "../../../../../infrastructure/database/db";
import type { AnyDatabase } from "@atlasmed/database";
import { territories, territoryTypes } from "@atlasmed/database";
import { eq, and, asc, sql } from "drizzle-orm";
import type {
  CreateTerritoryTypeInput,
  TerritoryTypeRecord,
  TerritoryTypeRepository,
  UpdateTerritoryTypeInput,
} from "../../../application/interfaces/territory-type.repository.interface";

function mapType(record: {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  canHaveBoundary: boolean;
  blockSiblingOverlap: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryTypeRecord {
  return record;
}

export class DrizzleTerritoryTypeRepository implements TerritoryTypeRepository {
  /**
 * Accepts a transaction handle so spec 0009 R1 can validate a boundary inside
 * the same transaction that later mutates it. Defaults to the shared pool, so
 * every existing caller is unchanged.
 */
  constructor(private readonly database: AnyDatabase = db) {}

  async findById(id: number): Promise<TerritoryTypeRecord | null> {
    const rows = await this.database
      .select()
      .from(territoryTypes)
      .where(eq(territoryTypes.id, id));
    return rows[0] ? mapType(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<TerritoryTypeRecord | null> {
    const rows = await this.database
      .select()
      .from(territoryTypes)
      .where(eq(territoryTypes.slug, slug.toLowerCase()));
    return rows[0] ? mapType(rows[0]) : null;
  }

  async findAll(activeOnly = true): Promise<TerritoryTypeRecord[]> {
    const rows = await this.database
      .select()
      .from(territoryTypes)
      .where(activeOnly ? eq(territoryTypes.isActive, true) : undefined)
      .orderBy(asc(territoryTypes.slug));
    return rows.map(mapType);
  }

  async create(input: CreateTerritoryTypeInput): Promise<TerritoryTypeRecord> {
    const [record] = await this.database
      .insert(territoryTypes)
      .values({
        slug: input.slug.toLowerCase(),
        name: input.name,
        description: input.description ?? null,
        canHaveBoundary: input.canHaveBoundary ?? true,
        blockSiblingOverlap: input.blockSiblingOverlap ?? false,
      })
      .returning();
    return mapType(record!);
  }

  async update(id: number, input: UpdateTerritoryTypeInput): Promise<TerritoryTypeRecord> {
    const [record] = await this.database
      .update(territoryTypes)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(territoryTypes.id, id))
      .returning();
    return mapType(record!);
  }

  async countTerritoriesUsingType(id: number): Promise<number> {
    const [result] = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(territories)
      .where(and(eq(territories.territoryTypeId, id), eq(territories.isActive, true)));
    return Number(result?.count ?? 0);
  }
}
