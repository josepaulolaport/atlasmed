import type { FieldSuggestionRecord } from "../interfaces/field-suggestion.repository.interface";
import {
  FIELD_KEY_LABELS_PT,
  isFieldSuggestionFieldKey,
} from "../constants/field-keys";

function normalizeJsonScalar(value: unknown): unknown {
  // postgres.js/drizzle can surface digit-only jsonb strings as numbers.
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return value;
}

export function serializeFieldSuggestion(record: FieldSuggestionRecord) {
  const fieldKey = record.fieldKey ?? undefined;
  const fieldLabel =
    record.kind === "DEACTIVATION"
      ? "Desativação"
      : fieldKey && isFieldSuggestionFieldKey(fieldKey)
        ? FIELD_KEY_LABELS_PT[fieldKey]
        : fieldKey ?? "Campo";

  const proposedValue =
    fieldKey && fieldKey !== "address"
      ? normalizeJsonScalar(record.proposedValue)
      : record.proposedValue;

  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    facilityId: record.facilityId,
    facilityName: record.facilityName,
    fieldKey,
    fieldLabel,
    currentValue: record.currentValue,
    proposedValue,
    reason: record.reason ?? undefined,
    submittedByUserId: record.submittedByUserId,
    submittedByName: record.submittedByName,
    submittedByRole: record.submittedByRole,
    submittedAt: record.submittedAt.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString(),
    resolvedByUserId: record.resolvedByUserId ?? undefined,
    resolvedByName: record.resolvedByName ?? undefined,
    resolutionNote: record.resolutionNote ?? undefined,
  };
}
