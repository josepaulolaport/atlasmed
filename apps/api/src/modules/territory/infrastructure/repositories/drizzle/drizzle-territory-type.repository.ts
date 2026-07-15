import { territories, territoryTypes } from '@atlasmed/database'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../../../../../infrastructure/database/db'
import type {
  CreateTerritoryTypeInput,
  TerritoryTypeRecord,
  TerritoryTypeRepository,
  UpdateTerritoryTypeInput
} from '../../../application/interfaces/territory-type.repository.interface'

function mapType(record: {
  id: string
  slug: string
  name: string
  description: string | null
  canHaveBoundary: boolean
  assignsClinics: boolean
  assignableToUsers: boolean
  assignableToManagers: boolean
  isCountryLevel: boolean
  blockSiblingOverlap: boolean
  participatesInGroupingHierarchy: boolean
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): TerritoryTypeRecord {
  return record
}

export class DrizzleTerritoryTypeRepository implements TerritoryTypeRepository {
  async findById(id: string): Promise<TerritoryTypeRecord | null> {
    const rows = await db.select().from(territoryTypes).where(eq(territoryTypes.id, id))
    return rows[0] ? mapType(rows[0]) : null
  }

  async findBySlug(slug: string): Promise<TerritoryTypeRecord | null> {
    const rows = await db
      .select()
      .from(territoryTypes)
      .where(eq(territoryTypes.slug, slug.toLowerCase()))
    return rows[0] ? mapType(rows[0]) : null
  }

  async findAll(activeOnly = true): Promise<TerritoryTypeRecord[]> {
    const rows = await db
      .select()
      .from(territoryTypes)
      .where(activeOnly ? eq(territoryTypes.isActive, true) : undefined)
      .orderBy(asc(territoryTypes.sortOrder), asc(territoryTypes.name))
    return rows.map(mapType)
  }

  async create(input: CreateTerritoryTypeInput): Promise<TerritoryTypeRecord> {
    const [record] = await db
      .insert(territoryTypes)
      .values({
        slug: input.slug.toLowerCase(),
        name: input.name,
        description: input.description ?? null,
        canHaveBoundary: input.canHaveBoundary ?? true,
        assignsClinics: input.assignsClinics ?? false,
        assignableToUsers: input.assignableToUsers ?? false,
        assignableToManagers: input.assignableToManagers ?? false,
        isCountryLevel: input.isCountryLevel ?? false,
        blockSiblingOverlap: input.blockSiblingOverlap ?? false,
        participatesInGroupingHierarchy: input.participatesInGroupingHierarchy ?? false,
        sortOrder: input.sortOrder ?? 0
      })
      .returning()
    return mapType(record!)
  }

  async update(id: string, input: UpdateTerritoryTypeInput): Promise<TerritoryTypeRecord> {
    const [record] = await db
      .update(territoryTypes)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(territoryTypes.id, id))
      .returning()
    return mapType(record!)
  }

  async countTerritoriesUsingType(id: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(territories)
      .where(and(eq(territories.territoryTypeId, id), eq(territories.isActive, true)))
    return Number(result?.count ?? 0)
  }
}
