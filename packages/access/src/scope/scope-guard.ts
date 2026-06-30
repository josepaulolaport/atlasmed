import type { ScopeContext } from "../contracts/scope-context.contract";
import { assertResourceInScope } from "./scope-enforcement.helpers";

/** Row-level scope guard for facilities (operational visibility). */
export function assertScopedFacility(scope: ScopeContext, facilityId: string): void {
  assertResourceInScope(scope, "facility", facilityId);
}

/** Row-level scope guard for territories (effective jurisdiction set). */
export function assertScopedTerritory(scope: ScopeContext, territoryId: string): void {
  assertResourceInScope(scope, "territory", territoryId);
}

/** Row-level scope guard for users visible to managers (managedUserIds). */
export function assertScopedUser(scope: ScopeContext, userId: string): void {
  assertResourceInScope(scope, "user", userId);
}
