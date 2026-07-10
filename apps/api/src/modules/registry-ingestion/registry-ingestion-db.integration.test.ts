import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import { eq, and, sql } from "drizzle-orm";
import { facilities, ingestionSuggestions, professionals } from "@atlasmed/database";
import { db } from "../../infrastructure/database/db";
import { isIntegrationDatabaseReady } from "../../test-utils/integration-database";
import {
  cleanupMockRegistryData,
  createRegistryIngestionStack,
  registryTestRepositories,
} from "./test-helpers/registry-test-factory";

describe("Registry Ingestion DB Integration Tests", () => {
  let dbReady = false;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
  });

  beforeEach(async () => {
    if (!dbReady) return;
    await cleanupMockRegistryData();
  });

  afterAll(async () => {
    if (!dbReady) return;
    await cleanupMockRegistryData();
  });

  it("v1 then v2 creates FACILITY_REGISTRY_DEACTIVATED suggestion without deactivating clinic", async () => {
    if (!dbReady) return;

    const { runIngestion } = createRegistryIngestionStack("snapshot-v1.json");
    await runIngestion.execute();

    const { runIngestion: runV2 } = createRegistryIngestionStack(
      "snapshot-v2-missing-clinic.json"
    );
    await runV2.execute();

    const clinic = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, "mock_registry"),
          eq(facilities.externalSourceId, "mock-clinic-001"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(clinic).toBeTruthy();
    expect(clinic?.sourcePresent).toBe(false);
    expect(clinic?.deletedAt).toBeNull();

    const suggestion = await db
      .select()
      .from(ingestionSuggestions)
      .where(
        and(
          eq(ingestionSuggestions.type, "FACILITY_REGISTRY_DEACTIVATED"),
          eq(ingestionSuggestions.status, "PENDING"),
          eq(ingestionSuggestions.facilityId, clinic!.id),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(suggestion).toBeTruthy();
  });

  it("approving FACILITY_REGISTRY_DEACTIVATED soft-deletes the clinic", async () => {
    if (!dbReady) return;

    const stack = createRegistryIngestionStack("snapshot-v1.json");
    await stack.runIngestion.execute();

    const stackV2 = createRegistryIngestionStack("snapshot-v2-missing-clinic.json");
    await stackV2.runIngestion.execute();

    const clinic = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, "mock_registry"),
          eq(facilities.externalSourceId, "mock-clinic-001"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    const suggestion = await db
      .select()
      .from(ingestionSuggestions)
      .where(
        and(
          eq(ingestionSuggestions.type, "FACILITY_REGISTRY_DEACTIVATED"),
          eq(ingestionSuggestions.status, "PENDING"),
          eq(ingestionSuggestions.facilityId, clinic!.id),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(suggestion).toBeTruthy();

    await stackV2.approveSuggestion.execute({
      suggestionId: suggestion!.id,
      userId: "admin-test",
      scope: createGlobalScopeContext(),
    });

    const updated = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, clinic!.id))
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(updated?.deletedAt).not.toBeNull();
  });

  it("soft-deleted clinic reappearing in source creates FACILITY_REGISTRY_REACTIVATED suggestion", async () => {
    if (!dbReady) return;

    const stack = createRegistryIngestionStack("snapshot-v1.json");
    await stack.runIngestion.execute();

    const clinic = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, "mock_registry"),
          eq(facilities.externalSourceId, "mock-clinic-001"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    await registryTestRepositories.facility.softDelete(clinic!.id);

    const stackV5 = createRegistryIngestionStack("snapshot-v5-reactivated-clinic.json");
    await stackV5.runIngestion.execute();

    const reactivation = await db
      .select()
      .from(ingestionSuggestions)
      .where(
        and(
          eq(ingestionSuggestions.type, "FACILITY_REGISTRY_REACTIVATED"),
          eq(ingestionSuggestions.status, "PENDING"),
          eq(ingestionSuggestions.facilityId, clinic!.id),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(reactivation).toBeTruthy();

    const stillDeleted = await db
      .select()
      .from(facilities)
      .where(eq(facilities.id, clinic!.id))
      .limit(1)
      .then((r) => r[0] ?? null);
    expect(stillDeleted?.deletedAt).not.toBeNull();
  });

  it("v1 then v4 creates FACILITY_PROFESSIONAL_REMOVAL without deleting professional", async () => {
    if (!dbReady) return;

    const stack = createRegistryIngestionStack("snapshot-v1.json");
    await stack.runIngestion.execute();

    const stackV4 = createRegistryIngestionStack("snapshot-v4-dropped-association.json");
    await stackV4.runIngestion.execute();

    const doctorCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(professionals)
      .where(eq(professionals.sourceProvider, "mock_registry"))
      .then((r) => Number(r[0]?.count ?? 0));

    expect(doctorCount).toBeGreaterThan(0);

    const suggestion = await db
      .select()
      .from(ingestionSuggestions)
      .where(
        and(
          eq(ingestionSuggestions.type, "FACILITY_PROFESSIONAL_REMOVAL"),
          eq(ingestionSuggestions.status, "PENDING"),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(suggestion).toBeTruthy();
  });
});
