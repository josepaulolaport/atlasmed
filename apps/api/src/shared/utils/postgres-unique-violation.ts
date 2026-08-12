/**
 * Walk nested driver errors for Postgres unique_violation (SQLSTATE 23505).
 *
 * Pass [constraints] to accept only violations of specific indexes. Without it
 * any unique violation matches, which is fine for a caller with one unique key
 * and wrong for one whose insert can collide on several — reporting the wrong
 * conflict sends the user looking for a problem they do not have.
 */
export function isPostgresUniqueViolation(
  error: unknown,
  constraints?: readonly string[],
): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4 && current != null; i += 1) {
    if (typeof current === "object" && current !== null && "code" in current) {
      if ((current as { code?: unknown }).code === "23505") {
        if (constraints === undefined) return true;
        const named = current as { constraint?: unknown; detail?: unknown };
        const constraint =
          typeof named.constraint === "string" ? named.constraint : "";
        // `detail` carries the index name when the driver omits `constraint`.
        const detail = typeof named.detail === "string" ? named.detail : "";
        return constraints.some(
          (name) => constraint === name || detail.includes(name),
        );
      }
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null;
  }
  return false;
}
