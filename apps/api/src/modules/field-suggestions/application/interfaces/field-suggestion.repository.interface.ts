import type {
  FieldSuggestionKind,
  FieldSuggestionStatus,
} from "@atlasmed/database";

export interface FieldSuggestionRecord {
  id: string;
  kind: FieldSuggestionKind;
  status: FieldSuggestionStatus;
  facilityId: string;
  facilityName: string;
  professionalId: string | null;
  fieldKey: string | null;
  currentValue: unknown;
  proposedValue: unknown;
  reason: string | null;
  submittedByUserId: string;
  submittedByName: string;
  submittedByRole: string;
  submittedAt: Date;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFieldSuggestionInput {
  id: string;
  kind: FieldSuggestionKind;
  facilityId: string;
  fieldKey: string | null;
  currentValue: unknown;
  proposedValue: unknown;
  reason: string | null;
  submittedByUserId: string;
}

export interface FieldSuggestionRepository {
  createWithSupersede(input: CreateFieldSuggestionInput): Promise<{
    suggestion: FieldSuggestionRecord;
    supersededIds: string[];
  }>;

  findById(id: string): Promise<FieldSuggestionRecord | null>;

  findAll(input: {
    page: number;
    limit: number;
    status?: FieldSuggestionStatus;
    facilityId?: string;
    facilityIds?: string[];
    submittedByUserId?: string;
  }): Promise<{ suggestions: FieldSuggestionRecord[]; total: number }>;

  resolve(
    id: string,
    input: {
      status: "APPROVED" | "REJECTED";
      resolvedByUserId: string;
      resolutionNote?: string | null;
    }
  ): Promise<FieldSuggestionRecord | null>;
}
