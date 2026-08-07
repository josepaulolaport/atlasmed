import { describe, expect, it } from "bun:test";
import { ResourceNotFoundError } from "../../../../shared/errors";
import type {
  PersonNoteRecord,
  PersonNoteRepository,
} from "../interfaces/person-note.repository.interface";
import {
  CreatePersonNoteUseCase,
  ListPersonNotesUseCase,
} from "./person-note.use-cases";

function createRepository(options?: {
  personExists?: boolean;
}): PersonNoteRepository & { notes: PersonNoteRecord[] } {
  const notes: PersonNoteRecord[] = [
    {
      id: 1,
      personId: 1,
      userId: 2,
      note: "Nota de outra pessoa",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    },
  ];

  return {
    notes,
    findActivePersonById: async (personId) =>
      options?.personExists === false || personId !== 1
        ? null
        : { id: personId },
    findByPersonAndUser: async (personId, userId) =>
      notes.filter(
        (note) => note.personId === personId && note.userId === userId
      ),
    create: async (input) => {
      const note: PersonNoteRecord = {
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

describe("person notes use cases", () => {
  it("lists only notes authored by the authenticated user", async () => {
    const repository = createRepository();
    const result = await new ListPersonNotesUseCase({
      personNoteRepository: repository,
    }).execute({ personId: 1, userId: 1 });

    expect(result).toEqual([]);
  });

  it("creates a note for the authenticated user and returns its DTO", async () => {
    const repository = createRepository();
    const result = await new CreatePersonNoteUseCase({
      personNoteRepository: repository,
    }).execute({
      personId: 1,
      userId: 1,
      note: "Lembrar de confirmar o retorno.",
    });

    expect(result).toEqual({
      id: 2,
      note: "Lembrar de confirmar o retorno.",
      createdAt: "2026-01-02T10:00:00.000Z",
      updatedAt: "2026-01-02T10:00:00.000Z",
    });
  });

  it("rejects create when person is missing or deleted", async () => {
    const repository = createRepository({ personExists: false });

    await expect(
      new CreatePersonNoteUseCase({
        personNoteRepository: repository,
      }).execute({
        personId: 1,
        userId: 1,
        note: "x",
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
