import { healthcareProviders } from '@atlasmed/database'
import { asc, eq, sql } from 'drizzle-orm'
import { db } from '../../../../../infrastructure/database/db'
import type {
  HealthcareProviderRecord,
  HealthcareProviderRepository,
  HealthcareProviderType
} from '../../../application/interfaces/healthcare-provider.repository.interface'

function mapProvider(row: {
  id: string
  name: string
  type: HealthcareProviderType
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): HealthcareProviderRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class DrizzleHealthcareProviderRepository implements HealthcareProviderRepository {
  async findAll(params: {
    page: number
    limit: number
    isActive?: boolean
  }): Promise<{ providers: HealthcareProviderRecord[]; total: number }> {
    const where =
      params.isActive === undefined ? undefined : eq(healthcareProviders.isActive, params.isActive)
    const skip = (params.page - 1) * params.limit

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(healthcareProviders)
        .where(where)
        .orderBy(asc(healthcareProviders.name))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(healthcareProviders).where(where)
    ])

    return { providers: rows.map(mapProvider), total: Number(countRows[0]?.count ?? 0) }
  }

  async findById(id: string): Promise<HealthcareProviderRecord | null> {
    const rows = await db.select().from(healthcareProviders).where(eq(healthcareProviders.id, id))
    return rows[0] ? mapProvider(rows[0]) : null
  }

  async create(data: {
    name: string
    type: HealthcareProviderType
    isActive?: boolean
  }): Promise<HealthcareProviderRecord> {
    const [provider] = await db
      .insert(healthcareProviders)
      .values({
        name: data.name,
        type: data.type,
        isActive: data.isActive ?? true
      })
      .returning()
    return mapProvider(provider!)
  }

  async update(
    id: string,
    data: { name?: string; type?: HealthcareProviderType; isActive?: boolean }
  ): Promise<HealthcareProviderRecord> {
    const [provider] = await db
      .update(healthcareProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(healthcareProviders.id, id))
      .returning()
    return mapProvider(provider!)
  }
}
