import {
  type cnesRunPhaseEnum,
  type cnesRunStatusEnum,
  cnesRuns,
  type cnesSuggestionStatusEnum,
  cnesSuggestions,
  type cnesSuggestionTypeEnum
} from '@atlasmed/database'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../../../../infrastructure/database/db'
import type {
  CreateSuggestionInput,
  IngestionRunRecord,
  IngestionRunRepository,
  IngestionSuggestionRecord,
  IngestionSuggestionRepository
} from '../../../application/interfaces/ingestion.repository.interface'

type CnesRunStatus = (typeof cnesRunStatusEnum.enumValues)[number]
type CnesRunPhase = (typeof cnesRunPhaseEnum.enumValues)[number]
type CnesSuggestionStatus = (typeof cnesSuggestionStatusEnum.enumValues)[number]
type CnesSuggestionType = (typeof cnesSuggestionTypeEnum.enumValues)[number]

function mapRun(run: {
  id: string
  sourceProvider: string
  status: CnesRunStatus
  phase: CnesRunPhase | null
  temporalWorkflowId: string | null
  referenceAno: number | null
  referenceMes: number | null
  startedAt: Date
  completedAt: Date | null
  promotedAt: Date | null
  stats: unknown
  validationReport: unknown
  archiveManifest: unknown
  error: string | null
}): IngestionRunRecord {
  return {
    id: run.id,
    sourceProvider: run.sourceProvider,
    status: run.status,
    phase: run.phase,
    temporalWorkflowId: run.temporalWorkflowId,
    referenceAno: run.referenceAno,
    referenceMes: run.referenceMes,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    promotedAt: run.promotedAt,
    stats: (run.stats as Record<string, unknown> | null) ?? null,
    validationReport: (run.validationReport as Record<string, unknown> | null) ?? null,
    archiveManifest: (run.archiveManifest as Record<string, unknown> | null) ?? null,
    error: run.error
  }
}

function mapSuggestion(suggestion: {
  id: string
  cnesRunId: string
  type: CnesSuggestionType
  status: CnesSuggestionStatus
  facilityId: string | null
  professionalId: string | null
  facilityProfessionalId: string | null
  reason: string | null
  payload: unknown
  suggestedAt: Date
  resolvedAt: Date | null
  resolvedByUserId: string | null
  resolutionNote: string | null
}): IngestionSuggestionRecord {
  return {
    id: suggestion.id,
    ingestionRunId: suggestion.cnesRunId,
    type: suggestion.type,
    status: suggestion.status,
    facilityId: suggestion.facilityId,
    professionalId: suggestion.professionalId,
    facilityProfessionalId: suggestion.facilityProfessionalId,
    reason: suggestion.reason,
    payload: (suggestion.payload as Record<string, unknown>) ?? {},
    suggestedAt: suggestion.suggestedAt,
    resolvedAt: suggestion.resolvedAt,
    resolvedByUserId: suggestion.resolvedByUserId,
    resolutionNote: suggestion.resolutionNote
  }
}

export class DrizzleIngestionRunRepository implements IngestionRunRepository {
  async create(
    sourceProvider: string,
    options?: {
      temporalWorkflowId?: string
      referenceAno?: number
      referenceMes?: number
    }
  ): Promise<IngestionRunRecord> {
    const [run] = await db
      .insert(cnesRuns)
      .values({
        sourceProvider,
        temporalWorkflowId: options?.temporalWorkflowId,
        referenceAno: options?.referenceAno,
        referenceMes: options?.referenceMes
      })
      .returning()

    return mapRun(run!)
  }

  async findById(id: string): Promise<IngestionRunRecord | null> {
    const rows = await db.select().from(cnesRuns).where(eq(cnesRuns.id, id))
    return rows[0] ? mapRun(rows[0]) : null
  }

  async complete(id: string, stats: Record<string, unknown>): Promise<IngestionRunRecord> {
    const [run] = await db
      .update(cnesRuns)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        stats
      })
      .where(eq(cnesRuns.id, id))
      .returning()

    return mapRun(run!)
  }

  async fail(id: string, error: string): Promise<IngestionRunRecord> {
    const [run] = await db
      .update(cnesRuns)
      .set({
        status: 'FAILED',
        phase: 'FAILED',
        completedAt: new Date(),
        error
      })
      .where(eq(cnesRuns.id, id))
      .returning()

    return mapRun(run!)
  }

  async findRecent(params: {
    page: number
    limit: number
    sourceProvider?: string
  }): Promise<{ runs: IngestionRunRecord[]; total: number }> {
    const where = params.sourceProvider
      ? eq(cnesRuns.sourceProvider, params.sourceProvider)
      : undefined

    const skip = (params.page - 1) * params.limit

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(cnesRuns)
        .where(where)
        .orderBy(desc(cnesRuns.startedAt))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(cnesRuns).where(where)
    ])

    return { runs: rows.map(mapRun), total: Number(countRows[0]?.count ?? 0) }
  }
}

export class DrizzleIngestionSuggestionRepository implements IngestionSuggestionRepository {
  async create(input: CreateSuggestionInput): Promise<IngestionSuggestionRecord> {
    const [suggestion] = await db
      .insert(cnesSuggestions)
      .values({
        cnesRunId: input.ingestionRunId,
        type: input.type,
        facilityId: input.facilityId,
        professionalId: input.professionalId,
        facilityProfessionalId: input.facilityProfessionalId,
        reason: input.reason,
        payload: (input.payload ?? {}) as Record<string, unknown>
      })
      .returning()

    return mapSuggestion(suggestion!)
  }

  async findPendingDuplicate(params: {
    type: CnesSuggestionType
    facilityId?: string
    professionalId?: string
    facilityProfessionalId?: string
  }): Promise<IngestionSuggestionRecord | null> {
    const conditions = [
      eq(cnesSuggestions.type, params.type),
      eq(cnesSuggestions.status, 'PENDING'),
      ...(params.facilityId != null ? [eq(cnesSuggestions.facilityId, params.facilityId)] : []),
      ...(params.professionalId != null
        ? [eq(cnesSuggestions.professionalId, params.professionalId)]
        : []),
      ...(params.facilityProfessionalId != null
        ? [eq(cnesSuggestions.facilityProfessionalId, params.facilityProfessionalId)]
        : [])
    ]

    const rows = await db
      .select()
      .from(cnesSuggestions)
      .where(and(...conditions))
      .limit(1)

    return rows[0] ? mapSuggestion(rows[0]) : null
  }

  async supersedePending(params: {
    type: CnesSuggestionType
    facilityId?: string
    professionalId?: string
    facilityProfessionalId?: string
  }): Promise<void> {
    const conditions = [
      eq(cnesSuggestions.type, params.type),
      eq(cnesSuggestions.status, 'PENDING'),
      ...(params.facilityId != null ? [eq(cnesSuggestions.facilityId, params.facilityId)] : []),
      ...(params.professionalId != null
        ? [eq(cnesSuggestions.professionalId, params.professionalId)]
        : []),
      ...(params.facilityProfessionalId != null
        ? [eq(cnesSuggestions.facilityProfessionalId, params.facilityProfessionalId)]
        : [])
    ]

    await db
      .update(cnesSuggestions)
      .set({ status: 'SUPERSEDED', resolvedAt: new Date() })
      .where(and(...conditions))
  }

  async findById(id: string): Promise<IngestionSuggestionRecord | null> {
    const rows = await db.select().from(cnesSuggestions).where(eq(cnesSuggestions.id, id))

    return rows[0] ? mapSuggestion(rows[0]) : null
  }

  async findAll(params: {
    page?: number
    limit?: number
    status?: CnesSuggestionStatus
    type?: CnesSuggestionType
    facilityIds?: string[]
  }): Promise<{ suggestions: IngestionSuggestionRecord[]; total: number }> {
    const page = params.page ?? 1
    const limit = params.limit ?? 20

    if (params.facilityIds !== undefined && params.facilityIds.length === 0) {
      return { suggestions: [], total: 0 }
    }

    const conditions = [
      ...(params.status ? [eq(cnesSuggestions.status, params.status)] : []),
      ...(params.type ? [eq(cnesSuggestions.type, params.type)] : []),
      ...(params.facilityIds ? [inArray(cnesSuggestions.facilityId, params.facilityIds)] : [])
    ]
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const skip = (page - 1) * limit

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(cnesSuggestions)
        .where(where)
        .orderBy(desc(cnesSuggestions.suggestedAt))
        .offset(skip)
        .limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(cnesSuggestions).where(where)
    ])

    return { suggestions: rows.map(mapSuggestion), total: Number(countRows[0]?.count ?? 0) }
  }

  async resolve(params: {
    id: string
    status: Extract<CnesSuggestionStatus, 'APPROVED' | 'REJECTED'>
    resolvedByUserId: string
    resolutionNote?: string
  }): Promise<IngestionSuggestionRecord> {
    const [suggestion] = await db
      .update(cnesSuggestions)
      .set({
        status: params.status,
        resolvedAt: new Date(),
        resolvedByUserId: params.resolvedByUserId,
        resolutionNote: params.resolutionNote
      })
      .where(eq(cnesSuggestions.id, params.id))
      .returning()

    return mapSuggestion(suggestion!)
  }
}
