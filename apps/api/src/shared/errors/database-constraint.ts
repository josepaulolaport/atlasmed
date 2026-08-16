import { AppError } from "./base-error";

/**
 * The Postgres SQLSTATEs a *caller* can cause, and what each one means to them.
 *
 * Everything else stays a 500: an admin typing a duplicate name is a mistake
 * they can fix, a broken query is ours.
 */
const CONSTRAINT_VIOLATIONS = {
  // unique_violation — "there is already one of these".
  "23505": {
    code: "RESOURCE_CONFLICT",
    status: 409,
    message: "A record with this value already exists.",
  },
  // foreign_key_violation, on a DELETE — something still points at this row.
  "23503": {
    code: "RESOURCE_IN_USE",
    status: 409,
    message:
      "This record is linked to others and cannot be changed or removed while they exist.",
  },
  // foreign_key_violation, on an INSERT or UPDATE — the row being *referenced*
  // does not exist. Same SQLSTATE, opposite meaning, and the caller's fix is the
  // opposite too: "pick a Linha that exists", not "remove what points at this".
  // Told apart by Postgres's own `detail`; see `toDatabaseConstraintError`.
  "23503_missing": {
    code: "RESOURCE_NOT_FOUND",
    status: 400,
    message: "One of the referenced records does not exist.",
  },
  // check_violation — a value the schema refuses, e.g. a non-positive quantity.
  "23514": {
    code: "CONSTRAINT_VIOLATION",
    status: 400,
    message: "One of the submitted values is not allowed.",
  },
  // not_null_violation — a required column left empty.
  "23502": {
    code: "CONSTRAINT_VIOLATION",
    status: 400,
    message: "A required field is missing.",
  },
} as const;

/**
 * A database constraint the caller tripped, mapped to an answer they can act on.
 *
 * These used to reach the global handler as unrecognised errors and come back as
 * `500 An unexpected error occurred. Please try again later.` — which is wrong
 * twice over: it reads as our fault, and it tells an admin who just typed a
 * duplicate SIMPRO code nothing about what to change. Spec 0016 §4 requires the
 * panel to surface the API's message rather than a generic one, and until this
 * existed there was no message worth surfacing.
 *
 * **The constraint name is never sent to the client.** It names our columns and
 * indexes; `toClientJSON` drops context by default, and this error deliberately
 * does not opt into the allow-list. The name still reaches the logs through
 * `toJSON`, which is where it is useful.
 */
export class DatabaseConstraintError extends AppError {
  constructor(
    sqlState: keyof typeof CONSTRAINT_VIOLATIONS,
    constraint: string | undefined
  ) {
    const mapping = CONSTRAINT_VIOLATIONS[sqlState];
    super(mapping.code, mapping.status, mapping.message, {
      sqlState,
      constraint,
    });
  }
}

/** The driver reports the SQLSTATE on the error, or on the error Drizzle wrapped. */
function readPostgresError(
  error: unknown
): { code?: string; constraint?: string; detail?: string } | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as {
    code?: unknown;
    constraint?: unknown;
    detail?: unknown;
    cause?: unknown;
  };
  if (typeof candidate.code === "string") {
    return {
      code: candidate.code,
      constraint:
        typeof candidate.constraint === "string" ? candidate.constraint : undefined,
      detail: typeof candidate.detail === "string" ? candidate.detail : undefined,
    };
  }
  // Drizzle rewraps driver errors, so the SQLSTATE is one level down.
  return candidate.cause ? readPostgresError(candidate.cause) : null;
}

/**
 * Returns a typed error for a constraint the caller tripped, or `null` when the
 * failure is not one of theirs to fix.
 */
export function toDatabaseConstraintError(
  error: unknown
): DatabaseConstraintError | null {
  const postgres = readPostgresError(error);
  if (!postgres?.code) return null;

  // A foreign key fails in two opposite directions. Postgres phrases them
  // differently in `detail`: "is not present in table" when the referenced row
  // is missing, "is still referenced from table" when this row is the one being
  // pointed at. Sending "cannot be removed while they exist" to an admin who
  // picked a Linha that does not exist describes the wrong problem entirely.
  if (
    postgres.code === "23503" &&
    postgres.detail?.includes("is not present in table")
  ) {
    return new DatabaseConstraintError("23503_missing", postgres.constraint);
  }

  if (!(postgres.code in CONSTRAINT_VIOLATIONS)) return null;
  return new DatabaseConstraintError(
    postgres.code as keyof typeof CONSTRAINT_VIOLATIONS,
    postgres.constraint
  );
}
