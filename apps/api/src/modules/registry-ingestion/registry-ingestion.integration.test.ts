import { beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RegistrySyncService } from "./application/services/registry-sync.service";
import { MockRegistrySourceAdapter } from "./infrastructure/adapters/mock-registry-source.adapter";
import type { ClinicRepository } from "../clinic/application/interfaces/clinic.repository.interface";
import type { DoctorRepository } from "../doctor/application/interfaces/doctor.repository.interface";
import type { DoctorClinicAssociationRepository } from "../clinic/application/interfaces/doctor-clinic-association.repository.interface";
import type { IngestionSuggestionRepository } from "./application/interfaces/ingestion.repository.interface";

const fixturesDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures"
);

describe("Registry ingestion Integration Tests", () => {
  let clinicRepository: ClinicRepository;
  let doctorRepository: DoctorRepository;
  let associationRepository: DoctorClinicAssociationRepository;
  let suggestionRepository: IngestionSuggestionRepository;
  let clinics: Map<string, any>;
  let doctors: Map<string, any>;
  let associations: Map<string, any>;
  let suggestions: any[];

  beforeEach(() => {
    clinics = new Map();
    doctors = new Map();
    associations = new Map();
    suggestions = [];

    clinicRepository = {
      findByExternalId: mock(async (provider, externalSourceId) => {
        const key = `${provider}:${externalSourceId}`;
        return clinics.get(key) ?? null;
      }),
      findSourceTrackedByProvider: mock(async (provider) =>
        [...clinics.values()].filter((c) => c.sourceProvider === provider && c.sourceTracked)
      ),
      upsertFromSource: mock(async (input) => {
        const key = `${input.sourceProvider}:${input.externalSourceId}`;
        const existing = clinics.get(key);
        if (!existing) {
          const clinic = {
            id: `clinic-${clinics.size + 1}`,
            ...input,
            sourcePresent: true,
            sourceTracked: true,
            manuallyEditedAt: null,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          clinics.set(key, clinic);
          return { clinic, created: true, updated: false };
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
        clinics.set(key, clinic);
        return { clinic, created: false, updated: true };
      }),
      markSourceAbsent: mock(async (id, sourceLastSeenAt) => {
        const clinic = [...clinics.values()].find((c) => c.id === id);
        if (clinic) {
          clinic.sourcePresent = false;
          clinic.sourceLastSeenAt = sourceLastSeenAt;
        }
      }),
      softDelete: mock(async () => {}),
      reactivate: mock(async () => {
        throw new Error("not used");
      }),
    } as unknown as ClinicRepository;

    doctorRepository = {
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
            clinicIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          doctors.set(key, doctor);
          return { doctor, created: true, updated: false };
        }
        const doctor = { ...existing, sourcePresent: true, sourceLastSeenAt: input.sourceLastSeenAt };
        doctors.set(key, doctor);
        return { doctor, created: false, updated: true };
      }),
      findSourceTrackedByProvider: mock(async (provider) =>
        [...doctors.values()].filter((d) => d.sourceProvider === provider && d.sourceTracked)
      ),
      markSourceAbsent: mock(async () => {}),
    } as unknown as DoctorRepository;

    associationRepository = {
      upsertSourceAssociation: mock(async ({ doctorId, clinicId, sourceLastSeenAt }) => {
        const key = `${doctorId}:${clinicId}`;
        const existing = associations.get(key);
        if (existing) {
          existing.sourceActive = true;
          existing.sourceLastSeenAt = sourceLastSeenAt;
          existing.endedAt = null;
          return { association: existing, created: false };
        }
        const association = {
          id: `assoc-${associations.size + 1}`,
          doctorId,
          clinicId,
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
            const doctor = [...doctors.values()].find((d) => d.id === association.doctorId);
            const clinic = [...clinics.values()].find((c) => c.id === association.clinicId);
            return {
              association,
              doctorExternalSourceId: doctor?.externalSourceId,
              clinicExternalSourceId: clinic?.externalSourceId,
            };
          })
          .filter((row) => row.doctorExternalSourceId && row.clinicExternalSourceId)
      ),
      markSourceInactive: mock(async ({ associationId, sourceLastSeenAt }) => {
        const association = [...associations.values()].find((a) => a.id === associationId);
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
    } as unknown as DoctorClinicAssociationRepository;

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

  it("creates removal suggestion without deactivating clinic", async () => {
    const sync = new RegistrySyncService({
      clinicRepository,
      doctorRepository,
      associationRepository,
      suggestionRepository,
    });

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

    const removedClinic = [...clinics.values()].find(
      (c) => c.externalSourceId === "mock-clinic-001"
    );

    expect(removedClinic?.sourcePresent).toBe(false);
    expect(removedClinic?.deletedAt).toBeNull();
    expect(suggestions.some((s) => s.type === "CLINIC_REMOVAL")).toBe(true);
  });

  it("creates association removal suggestion without deleting doctor", async () => {
    const sync = new RegistrySyncService({
      clinicRepository,
      doctorRepository,
      associationRepository,
      suggestionRepository,
    });

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
      suggestions.some((s) => s.type === "DOCTOR_CLINIC_REMOVAL")
    ).toBe(true);
    expect(
      [...associations.values()].some((a) => a.sourceActive === false && !a.endedAt)
    ).toBe(true);
  });
});
