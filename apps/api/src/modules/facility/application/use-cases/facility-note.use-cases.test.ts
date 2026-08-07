import { describe, expect, it, mock } from "bun:test";
import { type ScopeContext } from "@atlasmed/access";
import { ResourceNotFoundError } from "../../../../shared/errors";
import {
  CreateFacilityNoteUseCase,
  DeleteFacilityNoteUseCase,
  ListFacilityNotesUseCase,
  UpdateFacilityNoteUseCase,
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

function unusedOwned(): Pick<FacilityNoteRepository, "updateOwned" | "deleteOwned"> {
  return {
    updateOwned: async () => {
      throw new Error("unused");
    },
    deleteOwned: async () => {
      throw new Error("unused");
    },
  };
}

describe("Facility note use cases", () => {
  it("lists private notes for the current user", async () => {
    const findByFacilityAndUser = mock(async () => [
      {
        id: 1,
        userId: 1,
        facilityId: 1,
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
        ...unusedOwned(),
      } satisfies FacilityNoteRepository,
    }).execute({
      facilityId: 1,
      userId: 1,
      scope: globalScope,
    });

    expect(findByFacilityAndUser).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual([
      {
        id: 1,
        note: "Levar amostra",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);
  });

  it("creates a private note", async () => {
    const create = mock(async () => ({
      id: 2,
      userId: 1,
      facilityId: 1,
      note: "Retornar em agosto",
      createdAt: now,
      updatedAt: now,
    }));

    const result = await new CreateFacilityNoteUseCase({
      facilityNoteRepository: {
        findByFacilityAndUser: async () => [],
        create,
        ...unusedOwned(),
      },
    }).execute({
      facilityId: 1,
      userId: 1,
      note: "Retornar em agosto",
      scope: globalScope,
    });

    expect(create).toHaveBeenCalledWith({
      facilityId: 1,
      userId: 1,
      note: "Retornar em agosto",
    });
    expect(result.note).toBe("Retornar em agosto");
  });

  it("always creates the note for the authenticated actor", async () => {
    const create = mock(async (input: { facilityId: number; userId: number; note: string }) => ({
      id: 3,
      ...input,
      createdAt: now,
      updatedAt: now,
    }));

    await new CreateFacilityNoteUseCase({
      facilityNoteRepository: {
        findByFacilityAndUser: async () => [],
        create,
        ...unusedOwned(),
      },
    }).execute({
      facilityId: 101,
      userId: 11,
      note: "Nota do gestor",
      scope: globalScope,
    });

    expect(create).toHaveBeenCalledWith({
      facilityId: 101,
      userId: 11,
      note: "Nota do gestor",
    });
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
          ...unusedOwned(),
        },
      }).execute({
        facilityId: 999,
        userId: 1,
        scope: {
          ...globalScope,
          isGlobal: false,
          facilityIds: [1],
          clinicIds: [1],
        },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("updates caller-owned note", async () => {
    const updateOwned = mock(async () => ({
      id: 1,
      userId: 1,
      facilityId: 1,
      note: "Editada",
      createdAt: now,
      updatedAt: new Date("2026-01-16T12:00:00.000Z"),
    }));

    const result = await new UpdateFacilityNoteUseCase({
      facilityNoteRepository: {
        findByFacilityAndUser: async () => [],
        create: async () => {
          throw new Error("unused");
        },
        updateOwned,
        deleteOwned: async () => false,
      },
    }).execute({
      facilityId: 1,
      noteId: 1,
      userId: 1,
      note: "Editada",
      scope: globalScope,
    });

    expect(updateOwned).toHaveBeenCalledWith({
      noteId: 1,
      facilityId: 1,
      userId: 1,
      note: "Editada",
    });
    expect(result.note).toBe("Editada");
  });

  it("404s update when note missing or not owned", async () => {
    await expect(
      new UpdateFacilityNoteUseCase({
        facilityNoteRepository: {
          findByFacilityAndUser: async () => [],
          create: async () => {
            throw new Error("unused");
          },
          updateOwned: async () => null,
          deleteOwned: async () => false,
        },
      }).execute({
        facilityId: 1,
        noteId: 99,
        userId: 1,
        note: "x",
        scope: globalScope,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("deletes caller-owned note", async () => {
    const deleteOwned = mock(async () => true);
    const result = await new DeleteFacilityNoteUseCase({
      facilityNoteRepository: {
        findByFacilityAndUser: async () => [],
        create: async () => {
          throw new Error("unused");
        },
        updateOwned: async () => null,
        deleteOwned,
      },
    }).execute({
      facilityId: 1,
      noteId: 1,
      userId: 1,
      scope: globalScope,
    });

    expect(deleteOwned).toHaveBeenCalledWith({
      noteId: 1,
      facilityId: 1,
      userId: 1,
    });
    expect(result).toEqual({ id: 1, deleted: true });
  });

  it("404s delete when note missing or not owned", async () => {
    await expect(
      new DeleteFacilityNoteUseCase({
        facilityNoteRepository: {
          findByFacilityAndUser: async () => [],
          create: async () => {
            throw new Error("unused");
          },
          updateOwned: async () => null,
          deleteOwned: async () => false,
        },
      }).execute({
        facilityId: 1,
        noteId: 99,
        userId: 1,
        scope: globalScope,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
