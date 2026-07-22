import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  CreateFacilityNoteUseCase,
  ListFacilityNotesUseCase,
} from "./facility-note.use-cases";
import type { FacilityNoteRepository } from "../interfaces/facility-note.repository.interface";

const now = new Date("2026-01-15T12:00:00.000Z");

const globalScope: ScopeContext = {
  isGlobal: true,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: [],
  analyticsEffectiveTerritoryIds: [],
  territoryIds: [],
  facilityIds: [],
  analyticsFacilityIds: [],
  clinicIds: [],
  analyticsClinicIds: [],
  managedUserIds: [],
  isOperationallyActive: true,
};

describe("Facility note use cases", () => {
  it("lists private notes for the current user", async () => {
    const findByFacilityAndUser = mock(async () => [
      {
        id: "note-1",
        userId: "user-1",
        facilityId: "facility-1",
        note: "Levar amostra",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await new ListFacilityNotesUseCase({
      facilityNoteRepository: {
        findByFacilityAndUser,
        create: async () => {
          throw new Error("unused");
        },
      } satisfies FacilityNoteRepository,
    }).execute({
      facilityId: "facility-1",
      userId: "user-1",
      scope: globalScope,
    });

    expect(findByFacilityAndUser).toHaveBeenCalledWith("facility-1", "user-1");
    expect(result).toEqual([
      {
        id: "note-1",
        note: "Levar amostra",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);
  });

  it("creates a private note", async () => {
    const create = mock(async () => ({
      id: "note-2",
      userId: "user-1",
      facilityId: "facility-1",
      note: "Retornar em agosto",
      createdAt: now,
      updatedAt: now,
    }));

    const result = await new CreateFacilityNoteUseCase({
      facilityNoteRepository: {
        findByFacilityAndUser: async () => [],
        create,
      },
    }).execute({
      facilityId: "facility-1",
      userId: "user-1",
      note: "Retornar em agosto",
      scope: globalScope,
    });

    expect(create).toHaveBeenCalledWith({
      facilityId: "facility-1",
      userId: "user-1",
      note: "Retornar em agosto",
    });
    expect(result.note).toBe("Retornar em agosto");
  });

  it("denies facilities outside scope", async () => {
    await expect(
      new ListFacilityNotesUseCase({
        facilityNoteRepository: {
          findByFacilityAndUser: async () => {
            throw new Error("should not query");
          },
          create: async () => {
            throw new Error("unused");
          },
        },
      }).execute({
        facilityId: "facility-out",
        userId: "user-1",
        scope: {
          ...globalScope,
          isGlobal: false,
          facilityIds: ["facility-1"],
          clinicIds: ["facility-1"],
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
