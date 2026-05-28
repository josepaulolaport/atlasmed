import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { securityHeadersPlugin } from "./security-headers.middleware";

describe("securityHeadersPlugin", () => {
  it("sets security headers on responses", async () => {
    const app = new Elysia()
      .use(securityHeadersPlugin)
      .get("/health", () => ({ ok: true }));

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'"
    );
  });
});
