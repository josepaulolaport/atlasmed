import { describe, expect, it } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_SECURITY_MANIFEST } from "./route-security.manifest";

const SRC_ROOT = join(import.meta.dir, "..");

function readRouteFile(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), "utf-8");
}

function declaresProductionAuth(content: string): boolean {
  return content.includes(".use(auth)") || (
    content.includes("authPlugin: any = auth") && content.includes(".use(authPlugin)")
  );
}

/**
 * Matches a route *definition* — an HTTP verb whose first argument is a string
 * literal path (`.get("/facilities/:id", ...)`). Restricting to a leading `/`
 * keeps incidental `.get(` calls on Maps/Headers out of the results.
 */
const ROUTE_DEFINITION =
  /\.(get|post|put|patch|delete|head|options|all)\(\s*["'`](\/[^"'`]*)["'`]/g;

/**
 * Splits a route file into the individual Elysia chains it declares. Each
 * `new Elysia()` starts a fresh plugin instance, so guards installed with
 * `.use(...)` apply only within its own chain — which is exactly the unit the
 * per-route assertion must check.
 */
function splitElysiaChains(content: string): string[] {
  return content.split(/(?=new Elysia[(<])/).slice(1);
}

/**
 * Returns the paths of every route defined on a chain that does not install
 * `requirePermission`. An empty array means every route in the file is guarded.
 */
function findUnguardedRoutes(content: string): string[] {
  const unguarded: string[] = [];

  for (const chain of splitElysiaChains(content)) {
    const paths = [...chain.matchAll(ROUTE_DEFINITION)].map((m) => m[2]!);
    if (paths.length === 0) continue;
    if (chain.includes("requirePermission")) continue;
    unguarded.push(...paths);
  }

  return unguarded;
}

/**
 * Returns the paths of routes that inherit a guard declared *after* them.
 *
 * `requirePermission` installs `onBeforeHandle({ as: "scoped" })`, so a guard
 * applies to every route registered later in the same chain. Guards written
 * before all of a chain's routes are therefore deliberate — several routes
 * legitimately require two permissions at once. A guard written *between* two
 * routes is not: it silently ANDs itself onto everything below, and the routes
 * below never mention it.
 *
 * `territories.route.ts` accumulated eleven guards this way, which left its
 * later reads requiring `delete` and then `manage` — ADMIN-only, for a GET.
 */
function findRoutesBelowALateGuard(content: string): string[] {
  const trailing: string[] = [];

  for (const chain of splitElysiaChains(content)) {
    const firstRoute = ROUTE_DEFINITION.exec(chain)?.index;
    ROUTE_DEFINITION.lastIndex = 0;
    if (firstRoute === undefined) continue;

    const lateGuard = chain.indexOf("requirePermission(", firstRoute);
    if (lateGuard === -1) continue;

    for (const match of chain.slice(lateGuard).matchAll(ROUTE_DEFINITION)) {
      trailing.push(match[2]!);
    }
  }

  return trailing;
}

describe("route security registry (E.2)", () => {
  it("manifest covers every route file", () => {
    const routeFiles = [...new Glob("**/*.route.ts").scanSync({ cwd: SRC_ROOT })].sort();
    const manifestKeys = Object.keys(ROUTE_SECURITY_MANIFEST).sort();

    expect(routeFiles).toEqual(manifestKeys);
  });

  it("rejects an injected auth plugin that is not defaulted to production auth", () => {
    const content = `
      export function createRoutes(authPlugin: any) {
        return new Elysia().use(authPlugin).get("/unsafe", () => null);
      }
    `;

    expect(declaresProductionAuth(content)).toBe(false);
  });

  for (const [relativePath, level] of Object.entries(ROUTE_SECURITY_MANIFEST)) {
    it(`enforces ${level} on ${relativePath}`, () => {
      const content = readRouteFile(relativePath);

      if (level === "public") {
        expect(content.includes(".use(auth)")).toBe(false);
        return;
      }

      expect(declaresProductionAuth(content)).toBe(true);

      if (level === "auth+permission") {
        expect(content.includes("requirePermission")).toBe(true);

        // Per-route, not per-file: a single guarded route elsewhere in the file
        // must not vouch for a sibling that carries no guard of its own.
        expect(findUnguardedRoutes(content)).toEqual([]);

        // ...and no route may quietly inherit a permission declared below the
        // one it asks for. Split the chain: one instance per permission.
        expect(findRoutesBelowALateGuard(content)).toEqual([]);
      }
    });
  }
});
