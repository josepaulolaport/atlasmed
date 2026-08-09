import type {
  FieldSuggestionKind,
  FieldSuggestionStatus,
} from "@atlasmed/database";

export interface FieldSuggestionRecord {
  id: number;
  kind: FieldSuggestionKind;
  status: FieldSuggestionStatus;
  facilityId: number;
  facilityName: string;
  personId: number | null;
  fieldKey: string | null;
  currentValue: unknown;
  proposedValue: unknown;
  reason: string | null;
  submittedByUserId: number;
  submittedByName: string;
  submittedByRole: string;
  submittedAt: Date;
  resolvedAt: Date | null;
  resolvedByUserId: number | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFieldSuggestionInput {
  kind: FieldSuggestionKind;
  facilityId: number;
  fieldKey: string | null;
  currentValue: unknown;
  proposedValue: unknown;
  reason: string | null;
  submittedByUserId: number;
}

export interface FieldSuggestionRepository {
  createWithSupersede(input: CreateFieldSuggestionInput): Promise<{
    suggestion: FieldSuggestionRecord;
    supersededIds: number[];
  }>;

  findById(id: number): Promise<FieldSuggestionRecord | null>;

  findAll(input: {
    page: number;
    limit: number;
    status?: FieldSuggestionStatus;
    facilityId?: number;
    facilityIds?: number[];
    submittedByUserId?: number;
  }): Promise<{ suggestions: FieldSuggestionRecord[]; total: number }>;

  resolve(
    id: number,
    input: {
      status: "APPROVED" | "REJECTED";
      resolvedByUserId: number;
      resolutionNote?: string | null;
    }
  ): Promise<FieldSuggestionRecord | null>;
}
