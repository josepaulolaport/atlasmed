import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  IngestionRunRecord,
  IngestionRunRepository,
  IngestionSuggestionRecord,
  IngestionSuggestionRepository,
  CreateSuggestionInput,
} from "../../../application/interfaces/ingestion.repository.interface";
import type {
  IngestionRunStatus,
  IngestionSuggestionStatus,
  IngestionSuggestionType,
} from "@atlasmed/database";

function mapRun(run: {
  id: string;
  sourceProvider: string;
  status: IngestionRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  stats: unknown;
  error: string | null;
}): IngestionRunRecord {
  return {
    id: run.id,
    sourceProvider: run.sourceProvider,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    stats: (run.stats as Record<string, unknown> | null) ?? null,
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

export class PrismaIngestionRunRepository implements IngestionRunRepository {
  async create(sourceProvider: string): Promise<IngestionRunRecord> {
    const run = await prisma.ingestionRun.create({
      data: { sourceProvider },
    });

    return mapRun(run);
  }

  async complete(
    id: string,
    stats: Record<string, unknown>
  ): Promise<IngestionRunRecord> {
    const run = await prisma.ingestionRun.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        stats: stats as object,
      },
    });

    return mapRun(run);
  }

  async fail(id: string, error: string): Promise<IngestionRunRecord> {
    const run = await prisma.ingestionRun.update({
      where: { id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error,
      },
    });

    return mapRun(run);
  }

  async findRecent(params: {
    page: number;
    limit: number;
    sourceProvider?: string;
  }): Promise<{ runs: IngestionRunRecord[]; total: number }> {
    const where = params.sourceProvider
      ? { sourceProvider: params.sourceProvider }
      : {};

    const skip = (params.page - 1) * params.limit;

    const [runs, total] = await Promise.all([
      prisma.ingestionRun.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: params.limit,
      }),
      prisma.ingestionRun.count({ where }),
    ]);

    return { runs: runs.map(mapRun), total };
  }
}

export class PrismaIngestionSuggestionRepository
  implements IngestionSuggestionRepository
{
  async create(input: CreateSuggestionInput): Promise<IngestionSuggestionRecord> {
    const suggestion = await prisma.ingestionSuggestion.create({
      data: {
        ingestionRunId: input.ingestionRunId,
        type: input.type,
        facilityId: input.facilityId,
        professionalId: input.professionalId,
        facilityProfessionalId: input.facilityProfessionalId,
        reason: input.reason,
        payload: (input.payload ?? {}) as object,
      },
    });

    return mapSuggestion(suggestion);
  }

  async findPendingDuplicate(params: {
    type: IngestionSuggestionType;
    facilityId?: string;
    professionalId?: string;
    facilityProfessionalId?: string;
  }): Promise<IngestionSuggestionRecord | null> {
    const suggestion = await prisma.ingestionSuggestion.findFirst({
      where: {
        type: params.type,
        status: "PENDING",
        facilityId: params.facilityId ?? null,
        professionalId: params.professionalId ?? null,
        facilityProfessionalId: params.facilityProfessionalId ?? null,
      },
    });

    return suggestion ? mapSuggestion(suggestion) : null;
  }

  async supersedePending(params: {
    type: IngestionSuggestionType;
    facilityId?: string;
    professionalId?: string;
    facilityProfessionalId?: string;
  }): Promise<void> {
    await prisma.ingestionSuggestion.updateMany({
      where: {
        type: params.type,
        status: "PENDING",
        facilityId: params.facilityId ?? null,
        professionalId: params.professionalId ?? null,
        facilityProfessionalId: params.facilityProfessionalId ?? null,
      },
      data: { status: "SUPERSEDED", resolvedAt: new Date() },
    });
  }

  async findById(id: string): Promise<IngestionSuggestionRecord | null> {
    const suggestion = await prisma.ingestionSuggestion.findUnique({
      where: { id },
    });

    return suggestion ? mapSuggestion(suggestion) : null;
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

    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.facilityIds
        ? {
            facilityId: {
              in:
                params.facilityIds.length > 0
                  ? params.facilityIds
                  : ["__none__"],
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [suggestions, total] = await Promise.all([
      prisma.ingestionSuggestion.findMany({
        where,
        orderBy: { suggestedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.ingestionSuggestion.count({ where }),
    ]);

    return { suggestions: suggestions.map(mapSuggestion), total };
  }

  async resolve(params: {
    id: string;
    status: Extract<IngestionSuggestionStatus, "APPROVED" | "REJECTED">;
    resolvedByUserId: string;
    resolutionNote?: string;
  }): Promise<IngestionSuggestionRecord> {
    const suggestion = await prisma.ingestionSuggestion.update({
      where: { id: params.id },
      data: {
        status: params.status,
        resolvedAt: new Date(),
        resolvedByUserId: params.resolvedByUserId,
        resolutionNote: params.resolutionNote,
      },
    });

    return mapSuggestion(suggestion);
  }
}
