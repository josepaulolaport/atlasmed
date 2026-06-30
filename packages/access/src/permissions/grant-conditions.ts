import type { AccessGrantRecord } from "../contracts/access-grant.contract";
import { GRANT_RESOURCE_TO_SUBJECT } from "../contracts/access-grant.contract";
import type { Subject } from "./role.permissions";

const SUPPORTED_CONDITION_KEYS = new Set(["id"]);

const SCOPED_SUBJECTS = new Set<Subject>([
  "USER",
  "FACILITY",
  "PROFESSIONAL",
  "VISIT",
  "TERRITORY",
]);

export interface GrantConditionValidationIssue {
  field: string;
  message: string;
}

export class GrantConditionValidationError extends Error {
  constructor(public readonly issues: GrantConditionValidationIssue[]) {
    super(issues.map((issue) => issue.message).join("; "));
    this.name = "GrantConditionValidationError";
  }
}

function isScalarConditionValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function validateGrantConditions(input: {
  resource: string;
  resourceId?: string | null;
  conditions?: Record<string, unknown>;
}): Record<string, unknown> | undefined {
  if (!input.conditions || Object.keys(input.conditions).length === 0) {
    return undefined;
  }

  const subject = GRANT_RESOURCE_TO_SUBJECT[input.resource.toUpperCase()];
  if (!subject) {
    throw new GrantConditionValidationError([
      { field: "resource", message: `Unknown grant resource: ${input.resource}` },
    ]);
  }

  const issues: GrantConditionValidationIssue[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input.conditions)) {
    if (!SUPPORTED_CONDITION_KEYS.has(key)) {
      issues.push({
        field: `conditions.${key}`,
        message: `Unsupported grant condition key: ${key}`,
      });
      continue;
    }

    if (!isScalarConditionValue(value)) {
      issues.push({
        field: `conditions.${key}`,
        message: "Grant condition values must be string, number, or boolean",
      });
      continue;
    }

    if (key === "id") {
      if (typeof value !== "string" || value.length === 0) {
        issues.push({
          field: "conditions.id",
          message: "Grant condition id must be a non-empty string",
        });
        continue;
      }

      if (input.resourceId && value !== input.resourceId) {
        issues.push({
          field: "conditions.id",
          message: "Grant condition id must match resourceId when both are provided",
        });
        continue;
      }

      if (!SCOPED_SUBJECTS.has(subject)) {
        issues.push({
          field: "conditions.id",
          message: `Resource ${input.resource} does not support scoped id conditions`,
        });
        continue;
      }
    }

    sanitized[key] = value;
  }

  if (issues.length > 0) {
    throw new GrantConditionValidationError(issues);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function buildCaslConditionsFromGrant(
  grant: AccessGrantRecord
): Record<string, unknown> | undefined {
  const conditions: Record<string, unknown> = {};

  if (grant.resourceId) {
    conditions.id = grant.resourceId;
  }

  if (grant.conditions) {
    for (const [key, value] of Object.entries(grant.conditions)) {
      if (SUPPORTED_CONDITION_KEYS.has(key) && isScalarConditionValue(value)) {
        conditions[key] = value;
      }
    }
  }

  if (
    grant.resourceId &&
    typeof conditions.id === "string" &&
    conditions.id !== grant.resourceId
  ) {
    return { id: grant.resourceId };
  }

  return Object.keys(conditions).length > 0 ? conditions : undefined;
}
