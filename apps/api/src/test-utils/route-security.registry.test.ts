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
      }
    });
  }
});
