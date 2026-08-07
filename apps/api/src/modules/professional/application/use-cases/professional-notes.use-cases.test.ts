import { describe, expect, it } from "bun:test";
import { createGlobalScopeContext, withTerritoryScopeAliases } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import {
  CreateProfessionalNoteUseCase,
  ListProfessionalNotesUseCase,
} from "./professional.use-cases";

const professional = {
  id: 1,
  facilityIds: [1],
};

function createRepository() {
  const notes = [
    {
      id: 1,
      professionalId: 1,
      userId: 2,
      note: "Nota de outra pessoa",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    },
  ];

  return {
    findById: async () => professional,
    findNotesByProfessionalAndUser: async (professionalId: number, userId: number) =>
      notes.filter(
        (note) => note.professionalId === professionalId && note.userId === userId
      ),
    createNote: async (input: { professionalId: number; userId: number; note: string }) => {
      const note = {
        id: 2,
        ...input,
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
        updatedAt: new Date("2026-01-02T10:00:00.000Z"),
      };
      notes.push(note);
      return note;
    },
  };
}

describe("professional notes use cases", () => {
  it("lists only notes authored by the authenticated user", async () => {
    const repository = createRepository();
    const useCase = new ListProfessionalNotesUseCase({
      doctorRepository: repository as any,
    });

    const result = await useCase.execute({
      professionalId: 1,
      userId: 1,
      scope: createGlobalScopeContext(),
    });

    expect(result).toEqual([]);
  });

  it("creates a note for the authenticated user and returns its DTO", async () => {
    const repository = createRepository();
    const useCase = new CreateProfessionalNoteUseCase({
      doctorRepository: repository as any,
    });

    const result = await useCase.execute({
      professionalId: 1,
      userId: 1,
      note: "Lembrar de confirmar o retorno.",
      scope: createGlobalScopeContext(),
    });

    expect(result).toEqual({
      id: 2,
      note: "Lembrar de confirmar o retorno.",
      createdAt: "2026-01-02T10:00:00.000Z",
      updatedAt: "2026-01-02T10:00:00.000Z",
    });
  });

  it("rejects access to a professional outside the user scope", async () => {
    const repository = createRepository();
    const useCase = new ListProfessionalNotesUseCase({
      doctorRepository: repository as any,
    });
    const scope = withTerritoryScopeAliases({
      isGlobal: false,
      assignedTerritoryIds: [],
      effectiveTerritoryIds: [],
      analyticsEffectiveTerritoryIds: [],
      facilityIds: [99],
      analyticsFacilityIds: [],
      managedUserIds: [],
      isOperationallyActive: true,
    });

    await expect(
      useCase.execute({
        professionalId: 1,
        userId: 1,
        scope,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
