import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = import.meta.dir;

const PUBLIC_ROUTE_FILES = new Set([
  "login.route.ts",
  "verify-2fa-login.route.ts",
  "refresh-session.route.ts",
  "accept-invite.route.ts",
  "request-password-reset.route.ts",
  "reset-password.route.ts",
]);

const SUPPORTING_ROUTE_FILES = new Set([
  "refresh-cookie.ts",
  "user.serializer.ts",
]);

describe("Access routes auth registry", () => {
  const routeFiles = readdirSync(ROUTES_DIR).filter((file) =>
    file.endsWith(".route.ts")
  );

  it("requires auth on all non-public route modules", () => {
    const missingAuth: string[] = [];

    for (const file of routeFiles) {
      if (PUBLIC_ROUTE_FILES.has(file)) {
        continue;
      }

      const source = readFileSync(join(ROUTES_DIR, file), "utf8");
      if (!source.includes(".use(auth)")) {
        missingAuth.push(file);
      }
    }

    expect(missingAuth).toEqual([]);
  });

  it("keeps public auth endpoints free of auth plugin", () => {
    for (const file of PUBLIC_ROUTE_FILES) {
      const source = readFileSync(join(ROUTES_DIR, file), "utf8");
      expect(source.includes(".use(auth)")).toBe(false);
    }
  });

  it("documents route modules in registry sets", () => {
    const known = new Set([
      ...PUBLIC_ROUTE_FILES,
      ...SUPPORTING_ROUTE_FILES,
    ]);

    for (const file of routeFiles) {
      if (!known.has(file) && !readFileSync(join(ROUTES_DIR, file), "utf8").includes(".use(auth)")) {
        throw new Error(`Route file ${file} is neither public nor auth-protected`);
      }
    }
  });
});
