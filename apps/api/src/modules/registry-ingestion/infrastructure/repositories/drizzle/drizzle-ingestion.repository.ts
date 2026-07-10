import { db } from "../../../../../infrastructure/database/db";
import { ingestionRuns, ingestionSuggestions } from "@atlasmed/database";
import {
  ingestionRunStatusEnum,
  ingestionRunPhaseEnum,
  ingestionSuggestionStatusEnum,
  ingestionSuggestionTypeEnum,
} from "@atlasmed/database";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import type {
  IngestionRunRecord,
  IngestionRunRepository,
  IngestionSuggestionRecord,
  IngestionSuggestionRepository,
  CreateSuggestionInput,
} from "../../../application/interfaces/ingestion.repository.interface";

type IngestionRunStatus = typeof ingestionRunStatusEnum.enumValues[number];
type IngestionRunPhase = typeof ingestionRunPhaseEnum.enumValues[number];
type IngestionSuggestionStatus = typeof ingestionSuggestionStatusEnum.enumValues[number];
type IngestionSuggestionType = typeof ingestionSuggestionTypeEnum.enumValues[number];

function mapRun(run: {
  id: string;
  sourceProvider: string;
  status: IngestionRunStatus;
  phase: IngestionRunPhase | null;
  temporalWorkflowId: string | null;
  referenceAno: number | null;
  referenceMes: number | null;
  startedAt: Date;
  completedAt: Date | null;
  promotedAt: Date | null;
  stats: unknown;
  validationReport: unknown;
  archiveManifest: unknown;
  error: string | null;
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
    error: run.error,
  };
}

function mapSuggestion(suggestion: {
  id: string;
  ingestionRunId: string;
  type: IngestionSuggestionType;
  status: IngestionSuggestionStatus;
  facilityId: string | null;
  professionalId: string | null;
  facilityProfessionalId: string | null;
  reason: string | null;
  payload: unknown;
  suggestedAt: Date;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
}): IngestionSuggestionRecord {
  return {
    id: suggestion.id,
    ingestionRunId: suggestion.ingestionRunId,
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
    resolutionNote: suggestion.resolutionNote,
  };
}

export class DrizzleIngestionRunRepository implements IngestionRunRepository {
  async create(
    sourceProvider: string,
    options?: {
      temporalWorkflowId?: string;
      referenceAno?: number;
      referenceMes?: number;
    }
  ): Promise<IngestionRunRecord> {
    const [run] = await db
      .insert(ingestionRuns)
      .values({
        sourceProvider,
        temporalWorkflowId: options?.temporalWorkflowId,
        referenceAno: options?.referenceAno,
        referenceMes: options?.referenceMes,
      })
      .returning();

    return mapRun(run);
  }

  async findById(id: string): Promise<IngestionRunRecord | null> {
    const rows = await db
      .select()
      .from(ingestionRuns)
      .where(eq(ingestionRuns.id, id));
    return rows[0] ? mapRun(rows[0]) : null;
  }

  async complete(
    id: string,
    stats: Record<string, unknown>
  ): Promise<IngestionRunRecord> {
    const [run] = await db
      .update(ingestionRuns)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        stats,
      })
      .where(eq(ingestionRuns.id, id))
      .returning();

    return mapRun(run);
  }

  async fail(id: string, error: string): Promise<IngestionRunRecord> {
    const [run] = await db
      .update(ingestionRuns)
      .set({
        status: "FAILED",
        phase: "FAILED",
        completedAt: new Date(),
        error,
      })
      .where(eq(ingestionRuns.id, id))
      .returning();

    return mapRun(run);
  }

  async findRecent(params: {
    page: number;
    limit: number;
    sourceProvider?: string;
  }): Promise<{ runs: IngestionRunRecord[]; total: number }> {
    const where = params.sourceProvider
      ? eq(ingestionRuns.sourceProvider, params.sourceProvider)
      : undefined;

    const skip = (params.page - 1) * params.limit;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(ingestionRuns)
        .where(where)
        .orderBy(desc(ingestionRuns.startedAt))
        .offset(skip)
        .limit(params.limit),
      db.select({ count: sql<number>`count(*)` }).from(ingestionRuns).where(where),
    ]);

    return { runs: rows.map(mapRun), total: Number(count) };
  }
}

export class DrizzleIngestionSuggestionRepository
  implements IngestionSuggestionRepository
{
  async create(input: CreateSuggestionInput): Promise<IngestionSuggestionRecord> {
    const [suggestion] = await db
      .insert(ingestionSuggestions)
      .values({
        ingestionRunId: input.ingestionRunId,
        type: input.type,
        facilityId: input.facilityId,
        professionalId: input.professionalId,
        facilityProfessionalId: input.facilityProfessionalId,
        reason: input.reason,
        payload: (input.payload ?? {}) as Record<string, unknown>,
      })
      .returning();

    return mapSuggestion(suggestion);
  }

  async findPendingDuplicate(params: {
    type: IngestionSuggestionType;
    facilityId?: string;
    professionalId?: string;
    facilityProfessionalId?: string;
  }): Promise<IngestionSuggestionRecord | null> {
    const conditions = [
      eq(ingestionSuggestions.type, params.type),
      eq(ingestionSuggestions.status, "PENDING"),
      ...(params.facilityId != null
        ? [eq(ingestionSuggestions.facilityId, params.facilityId)]
        : []),
      ...(params.professionalId != null
        ? [eq(ingestionSuggestions.professionalId, params.professionalId)]
        : []),
      ...(params.facilityProfessionalId != null
        ? [eq(ingestionSuggestions.facilityProfessionalId, params.facilityProfessionalId)]
        : []),
    ];

    const rows = await db
      .select()
      .from(ingestionSuggestions)
      .where(and(...conditions))
      .limit(1);

    return rows[0] ? mapSuggestion(rows[0]) : null;
  }

  async supersedePending(params: {
    type: IngestionSuggestionType;
    facilityId?: string;
    professionalId?: string;
    facilityProfessionalId?: string;
  }): Promise<void> {
    const conditions = [
      eq(ingestionSuggestions.type, params.type),
      eq(ingestionSuggestions.status, "PENDING"),
      ...(params.facilityId != null
        ? [eq(ingestionSuggestions.facilityId, params.facilityId)]
        : []),
      ...(params.professionalId != null
        ? [eq(ingestionSuggestions.professionalId, params.professionalId)]
        : []),
      ...(params.facilityProfessionalId != null
        ? [eq(ingestionSuggestions.facilityProfessionalId, params.facilityProfessionalId)]
        : []),
    ];

    await db
      .update(ingestionSuggestions)
      .set({ status: "SUPERSEDED", resolvedAt: new Date() })
      .where(and(...conditions));
  }

  async findById(id: string): Promise<IngestionSuggestionRecord | null> {
    const rows = await db
      .select()
      .from(ingestionSuggestions)
      .where(eq(ingestionSuggestions.id, id));

    return rows[0] ? mapSuggestion(rows[0]) : null;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    status?: IngestionSuggestionStatus;
    type?: IngestionSuggestionType;
    facilityIds?: string[];
  }): Promise<{ suggestions: IngestionSuggestionRecord[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    if (params.facilityIds !== undefined && params.facilityIds.length === 0) {
      return { suggestions: [], total: 0 };
    }

    const conditions = [
      ...(params.status ? [eq(ingestionSuggestions.status, params.status)] : []),
      ...(params.type ? [eq(ingestionSuggestions.type, params.type)] : []),
      ...(params.facilityIds
        ? [inArray(ingestionSuggestions.facilityId, params.facilityIds)]
        : []),
    ];
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const skip = (page - 1) * limit;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select()
        .from(ingestionSuggestions)
        .where(where)
        .orderBy(desc(ingestionSuggestions.suggestedAt))
        .offset(skip)
        .limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(ingestionSuggestions).where(where),
    ]);

    return { suggestions: rows.map(mapSuggestion), total: Number(count) };
  }

  async resolve(params: {
    id: string;
    status: Extract<IngestionSuggestionStatus, "APPROVED" | "REJECTED">;
    resolvedByUserId: string;
    resolutionNote?: string;
  }): Promise<IngestionSuggestionRecord> {
    const [suggestion] = await db
      .update(ingestionSuggestions)
      .set({
        status: params.status,
        resolvedAt: new Date(),
        resolvedByUserId: params.resolvedByUserId,
        resolutionNote: params.resolutionNote,
      })
      .where(eq(ingestionSuggestions.id, params.id))
      .returning();

    return mapSuggestion(suggestion);
  }
}
