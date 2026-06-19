import { describe, expect, it } from "bun:test";
import { McpTestRepository } from "./mcp-test.repository";

describe("McpTestRepository", () => {
  const repository = new McpTestRepository();

  it("allows browsing facilities without a search term", async () => {
    const result = await repository.listFacilities({ page: 1, limit: 5 });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0]?.professionalCount ?? 0).toBeGreaterThan(0);
    expect(result.pagination.page).toBe(1);
  });

  it(
    "allows browsing professionals without a search term",
    async () => {
      const result = await repository.listProfessionals({ page: 1, limit: 5 });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.activeFacilitiesCount ?? 0).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
    },
    { timeout: 30_000 },
  );
});
