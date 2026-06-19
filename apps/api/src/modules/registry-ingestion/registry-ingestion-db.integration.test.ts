import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import { prisma } from "../../infrastructure/database/prisma.client";
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

  it("v1 then v2 creates CLINIC_REMOVAL suggestion without deactivating clinic", async () => {
    if (!dbReady) return;

    const { runIngestion } = createRegistryIngestionStack("snapshot-v1.json");
    await runIngestion.execute();

    const { runIngestion: runV2 } = createRegistryIngestionStack(
      "snapshot-v2-missing-clinic.json"
    );
    await runV2.execute();

    const clinic = await prisma.clinic.findFirst({
      where: {
        sourceProvider: "mock_registry",
        externalSourceId: "mock-clinic-001",
      },
    });

    expect(clinic).toBeTruthy();
    expect(clinic?.sourcePresent).toBe(false);
    expect(clinic?.deletedAt).toBeNull();

    const suggestion = await prisma.ingestionSuggestion.findFirst({
      where: {
        type: "CLINIC_REMOVAL",
        status: "PENDING",
        clinicId: clinic!.id,
      },
    });

    expect(suggestion).toBeTruthy();
  });

  it("approving CLINIC_REMOVAL soft-deletes the clinic", async () => {
    if (!dbReady) return;

    const stack = createRegistryIngestionStack("snapshot-v1.json");
    await stack.runIngestion.execute();

    const stackV2 = createRegistryIngestionStack("snapshot-v2-missing-clinic.json");
    await stackV2.runIngestion.execute();

    const clinic = await prisma.clinic.findFirst({
      where: {
        sourceProvider: "mock_registry",
        externalSourceId: "mock-clinic-001",
      },
    });

    const suggestion = await prisma.ingestionSuggestion.findFirst({
      where: {
        type: "CLINIC_REMOVAL",
        status: "PENDING",
        clinicId: clinic!.id,
      },
    });

    expect(suggestion).toBeTruthy();

    await stackV2.approveSuggestion.execute({
      suggestionId: suggestion!.id,
      userId: "admin-test",
      scope: createGlobalScopeContext(),
    });

    const updated = await prisma.clinic.findUnique({
      where: { id: clinic!.id },
    });

    expect(updated?.deletedAt).not.toBeNull();
  });

  it("soft-deleted clinic reappearing in source creates CLINIC_REACTIVATION suggestion", async () => {
    if (!dbReady) return;

    const stack = createRegistryIngestionStack("snapshot-v1.json");
    await stack.runIngestion.execute();

    const clinic = await prisma.clinic.findFirst({
      where: {
        sourceProvider: "mock_registry",
        externalSourceId: "mock-clinic-001",
      },
    });

    await registryTestRepositories.clinic.softDelete(clinic!.id);

    const stackV5 = createRegistryIngestionStack("snapshot-v5-reactivated-clinic.json");
    await stackV5.runIngestion.execute();

    const reactivation = await prisma.ingestionSuggestion.findFirst({
      where: {
        type: "CLINIC_REACTIVATION",
        status: "PENDING",
        clinicId: clinic!.id,
      },
    });

    expect(reactivation).toBeTruthy();

    const stillDeleted = await prisma.clinic.findUnique({
      where: { id: clinic!.id },
    });
    expect(stillDeleted?.deletedAt).not.toBeNull();
  });

  it("v1 then v4 creates DOCTOR_CLINIC_REMOVAL without deleting doctor", async () => {
    if (!dbReady) return;

    const stack = createRegistryIngestionStack("snapshot-v1.json");
    await stack.runIngestion.execute();

    const stackV4 = createRegistryIngestionStack("snapshot-v4-dropped-association.json");
    await stackV4.runIngestion.execute();

    const doctorCount = await prisma.doctor.count({
      where: { sourceProvider: "mock_registry" },
    });

    expect(doctorCount).toBeGreaterThan(0);

    const suggestion = await prisma.ingestionSuggestion.findFirst({
      where: { type: "DOCTOR_CLINIC_REMOVAL", status: "PENDING" },
    });

    expect(suggestion).toBeTruthy();
  });
});
