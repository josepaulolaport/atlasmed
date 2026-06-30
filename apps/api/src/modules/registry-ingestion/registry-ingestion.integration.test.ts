import { beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RegistrySyncService } from "./application/services/registry-sync.service";
import { RegistryDiffService } from "./application/services/registry-diff.service";
import { MockRegistrySourceAdapter } from "./infrastructure/adapters/mock-registry-source.adapter";
import type { FacilityRepository } from "../facility/application/interfaces/facility.repository.interface";
import type { ProfessionalRepository } from "../professional/application/interfaces/professional.repository.interface";
import type { FacilityProfessionalRepository } from "../facility/application/interfaces/facility-professional.repository.interface";
import type { IngestionSuggestionRepository } from "./application/interfaces/ingestion.repository.interface";

const fixturesDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures"
);

describe("Registry ingestion Integration Tests", () => {
  let facilityRepository: FacilityRepository;
  let professionalRepository: ProfessionalRepository;
  let facilityProfessionalRepository: FacilityProfessionalRepository;
  let suggestionRepository: IngestionSuggestionRepository;
  let facilities: Map<string, any>;
  let doctors: Map<string, any>;
  let associations: Map<string, any>;
  let suggestions: any[];

  beforeEach(() => {
    facilities = new Map();
    doctors = new Map();
    associations = new Map();
    suggestions = [];

    facilityRepository = {
      findById: mock(async (id) => [...facilities.values()].find((f) => f.id === id) ?? null),
      findByExternalId: mock(async (provider, externalSourceId) => {
        const key = `${provider}:${externalSourceId}`;
        return facilities.get(key) ?? null;
      }),
      findSourceTrackedByProvider: mock(async (provider) =>
        [...facilities.values()].filter((c) => c.sourceProvider === provider && c.sourceTracked)
      ),
      upsertFromSource: mock(async (input) => {
        const key = `${input.sourceProvider}:${input.externalSourceId}`;
        const existing = facilities.get(key);
        if (!existing) {
          const clinic = {
            id: `clinic-${facilities.size + 1}`,
            ...input,
            sourcePresent: true,
            sourceTracked: true,
            manuallyEditedAt: null,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          facilities.set(key, clinic);
          return { facility: clinic, created: true, updated: false };
        }

        const clinic = {
          ...existing,
          sourceContentHash: input.sourceContentHash,
          sourceLastSeenAt: input.sourceLastSeenAt,
          sourcePresent: true,
          sourceTracked: true,
          name: existing.manuallyEditedAt ? existing.name : input.name,
          address: existing.manuallyEditedAt ? existing.address : input.address,
        };
        facilities.set(key, clinic);
        return { facility: clinic, created: false, updated: true };
      }),
      markSourceAbsent: mock(async (id, sourceLastSeenAt) => {
        const clinic = [...facilities.values()].find((c) => c.id === id);
        if (clinic) {
          clinic.sourcePresent = false;
          clinic.sourceLastSeenAt = sourceLastSeenAt;
        }
      }),
      softDelete: mock(async (id) => {
        const clinic = [...facilities.values()].find((c) => c.id === id);
        if (clinic) {
          clinic.deletedAt = new Date();
        }
      }),
      reactivate: mock(async (id) => {
        const clinic = [...facilities.values()].find((c) => c.id === id);
        if (clinic) {
          clinic.deletedAt = null;
        }
      }),
    } as unknown as FacilityRepository;

    professionalRepository = {
      upsertFromSource: mock(async (input) => {
        const key = `${input.sourceProvider}:${input.externalSourceId}`;
        const existing = doctors.get(key);
        if (!existing) {
          const doctor = {
            id: `doctor-${doctors.size + 1}`,
            ...input,
            sourcePresent: true,
            sourceTracked: true,
            manuallyEditedAt: null,
            deletedAt: null,
            facilityIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          doctors.set(key, doctor);
          return { professional: doctor, created: true, updated: false };
        }
        const doctor = { ...existing, sourcePresent: true, sourceLastSeenAt: input.sourceLastSeenAt };
        doctors.set(key, doctor);
        return { professional: doctor, created: false, updated: true };
      }),
      findSourceTrackedByProvider: mock(async (provider) =>
        [...doctors.values()].filter((d) => d.sourceProvider === provider && d.sourceTracked)
      ),
      markSourceAbsent: mock(async () => {}),
    } as unknown as ProfessionalRepository;

    facilityProfessionalRepository = {
      upsertSourceAssociation: mock(async ({ professionalId, facilityId, sourceLastSeenAt }) => {
        const key = `${professionalId}:${facilityId}`;
        const existing = associations.get(key);
        if (existing) {
          existing.sourceActive = true;
          existing.sourceLastSeenAt = sourceLastSeenAt;
          existing.endedAt = null;
          return { association: existing, created: false };
        }
        const association = {
          id: `assoc-${associations.size + 1}`,
          professionalId,
          facilityId,
          sourceActive: true,
          sourceFirstSeenAt: sourceLastSeenAt,
          sourceLastSeenAt,
          confirmedAt: null,
          confirmedByUserId: null,
          endedAt: null,
          endedByUserId: null,
          endReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        associations.set(key, association);
        return { association, created: true };
      }),
      findActiveSourceAssociationsByProvider: mock(async () =>
        [...associations.values()]
          .filter((a) => a.sourceActive && !a.endedAt)
          .map((association) => {
            const doctor = [...doctors.values()].find((d) => d.id === association.professionalId);
            const clinic = [...facilities.values()].find((c) => c.id === association.facilityId);
            return {
              association,
              professionalExternalSourceId: doctor?.externalSourceId,
              facilityExternalSourceId: clinic?.externalSourceId,
            };
          })
          .filter((row) => row.professionalExternalSourceId && row.facilityExternalSourceId)
      ),
      markSourceInactive: mock(async ({ facilityProfessionalId, sourceLastSeenAt }) => {
        const association = [...associations.values()].find((a) => a.id === facilityProfessionalId);
        if (!association) throw new Error("missing");
        association.sourceActive = false;
        association.sourceLastSeenAt = sourceLastSeenAt;
        return association;
      }),
      restoreSourceActive: mock(async () => {
        throw new Error("not used");
      }),
      endAssociationById: mock(async () => {
        throw new Error("not used");
      }),
    } as unknown as FacilityProfessionalRepository;

    suggestionRepository = {
      create: mock(async (input) => {
        const suggestion = {
          id: `sug-${suggestions.length + 1}`,
          ...input,
          status: "PENDING",
          suggestedAt: new Date(),
          resolvedAt: null,
          resolvedByUserId: null,
          resolutionNote: null,
        };
        suggestions.push(suggestion);
        return suggestion;
      }),
      findPendingDuplicate: mock(async () => null),
      supersedePending: mock(async () => {}),
      findById: mock(async () => null),
      findAll: mock(async () => ({ suggestions, total: suggestions.length })),
      resolve: mock(async () => {
        throw new Error("not used");
      }),
    } as unknown as IngestionSuggestionRepository;
  });

  function createSyncService() {
    const registryDiffService = new RegistryDiffService({
      facilityRepository,
      suggestionRepository,
    });
    return new RegistrySyncService({
      facilityRepository,
      professionalRepository,
      facilityProfessionalRepository,
      suggestionRepository,
      registryDiffService,
    });
  }

  it("creates removal suggestion without deactivating facility", async () => {
    const sync = createSyncService();

    const v1 = await new MockRegistrySourceAdapter(
      "snapshot-v1.json",
      fixturesDir
    ).fetchSnapshot();
    await sync.syncSnapshot({ snapshot: v1, ingestionRunId: "run-1" });

    const v2 = await new MockRegistrySourceAdapter(
      "snapshot-v2-missing-clinic.json",
      fixturesDir
    ).fetchSnapshot();
    await sync.syncSnapshot({ snapshot: v2, ingestionRunId: "run-2" });

    const removedFacility = [...facilities.values()].find(
      (c) => c.externalSourceId === "mock-clinic-001"
    );

    expect(removedFacility?.sourcePresent).toBe(false);
    expect(removedFacility?.deletedAt).toBeNull();
    expect(suggestions.some((s) => s.type === "FACILITY_REGISTRY_DEACTIVATED")).toBe(true);
  });

  it("creates association removal suggestion without deleting professional", async () => {
    const sync = createSyncService();

    const v1 = await new MockRegistrySourceAdapter(
      "snapshot-v1.json",
      fixturesDir
    ).fetchSnapshot();
    await sync.syncSnapshot({ snapshot: v1, ingestionRunId: "run-1" });

    const v4 = await new MockRegistrySourceAdapter(
      "snapshot-v4-dropped-association.json",
      fixturesDir
    ).fetchSnapshot();
    await sync.syncSnapshot({ snapshot: v4, ingestionRunId: "run-4" });

    expect(doctors.size).toBeGreaterThan(0);
    expect(
      suggestions.some((s) => s.type === "FACILITY_PROFESSIONAL_REMOVAL")
    ).toBe(true);
    expect(
      [...associations.values()].some((a) => a.sourceActive === false && !a.endedAt)
    ).toBe(true);
  });

  it("creates reactivation suggestion when soft-deleted facility reappears in source", async () => {
    const sync = createSyncService();

    const v1 = await new MockRegistrySourceAdapter(
      "snapshot-v1.json",
      fixturesDir
    ).fetchSnapshot();
    await sync.syncSnapshot({ snapshot: v1, ingestionRunId: "run-1" });

    const clinic = [...facilities.values()].find(
      (c) => c.externalSourceId === "mock-clinic-001"
    );
    clinic!.deletedAt = new Date();

    const v5 = await new MockRegistrySourceAdapter(
      "snapshot-v5-reactivated-clinic.json",
      fixturesDir
    ).fetchSnapshot();
    await sync.syncSnapshot({ snapshot: v5, ingestionRunId: "run-5" });

    expect(clinic?.deletedAt).not.toBeNull();
    expect(
      suggestions.some((s) => s.type === "FACILITY_REGISTRY_REACTIVATED" && s.facilityId === clinic?.id)
    ).toBe(true);
  });
});
