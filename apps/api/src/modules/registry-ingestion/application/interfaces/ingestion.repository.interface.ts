import type {
  IngestionRunStatus,
  IngestionSuggestionStatus,
  IngestionSuggestionType,
} from "@atlasmed/database";

export interface IngestionRunRecord {
  id: string;
  sourceProvider: string;
  status: IngestionRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  stats: Record<string, unknown> | null;
  error: string | null;
}

export interface IngestionRunRepository {
  create(sourceProvider: string): Promise<IngestionRunRecord>;

  complete(
    id: string,
    stats: Record<string, unknown>
  ): Promise<IngestionRunRecord>;

  fail(id: string, error: string): Promise<IngestionRunRecord>;

  findRecent(params: {
    page: number;
    limit: number;
    sourceProvider?: string;
  }): Promise<{ runs: IngestionRunRecord[]; total: number }>;
}

export interface IngestionSuggestionRecord {
  id: string;
  ingestionRunId: string;
  type: IngestionSuggestionType;
  status: IngestionSuggestionStatus;
  clinicId: string | null;
  doctorId: string | null;
  associationId: string | null;
  reason: string | null;
  payload: Record<string, unknown>;
  suggestedAt: Date;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionNote: string | null;
}

export interface CreateSuggestionInput {
  ingestionRunId: string;
  type: IngestionSuggestionType;
  clinicId?: string;
  doctorId?: string;
  associationId?: string;
  reason?: string;
  payload?: Record<string, unknown>;
}

export interface IngestionSuggestionRepository {
  create(input: CreateSuggestionInput): Promise<IngestionSuggestionRecord>;

  findPendingDuplicate(params: {
    type: IngestionSuggestionType;
    clinicId?: string;
    doctorId?: string;
    associationId?: string;
  }): Promise<IngestionSuggestionRecord | null>;

  supersedePending(params: {
    type: IngestionSuggestionType;
    clinicId?: string;
    doctorId?: string;
    associationId?: string;
  }): Promise<void>;

  findById(id: string): Promise<IngestionSuggestionRecord | null>;

  findAll(params: {
    page?: number;
    limit?: number;
    status?: IngestionSuggestionStatus;
    type?: IngestionSuggestionType;
    clinicIds?: string[];
  }): Promise<{ suggestions: IngestionSuggestionRecord[]; total: number }>;

  resolve(params: {
    id: string;
    status: Extract<IngestionSuggestionStatus, "APPROVED" | "REJECTED">;
    resolvedByUserId: string;
    resolutionNote?: string;
  }): Promise<IngestionSuggestionRecord>;
}
