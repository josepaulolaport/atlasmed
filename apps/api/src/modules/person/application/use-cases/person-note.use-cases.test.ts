import { describe, expect, it } from "bun:test";
import { ResourceNotFoundError } from "../../../../shared/errors";
import type {
  PersonNoteRecord,
  PersonNoteRepository,
} from "../interfaces/person-note.repository.interface";
import {
  CreatePersonNoteUseCase,
  DeletePersonNoteUseCase,
  ListPersonNotesUseCase,
  UpdatePersonNoteUseCase,
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
    {
      id: 3,
      personId: 1,
      userId: 1,
      note: "Minha nota",
      createdAt: new Date("2026-01-01T11:00:00.000Z"),
      updatedAt: new Date("2026-01-01T11:00:00.000Z"),
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
    updateOwned: async (input) => {
      const idx = notes.findIndex(
        (n) =>
          n.id === input.noteId &&
          n.personId === input.personId &&
          n.userId === input.userId
      );
      if (idx < 0) return null;
      const updated: PersonNoteRecord = {
        ...notes[idx]!,
        note: input.note,
        updatedAt: new Date("2026-01-03T10:00:00.000Z"),
      };
      notes[idx] = updated;
      return updated;
    },
    deleteOwned: async (input) => {
      const idx = notes.findIndex(
        (n) =>
          n.id === input.noteId &&
          n.personId === input.personId &&
          n.userId === input.userId
      );
      if (idx < 0) return false;
      notes.splice(idx, 1);
      return true;
    },
  };
}

describe("person notes use cases", () => {
  it("lists only notes authored by the authenticated user", async () => {
    const repository = createRepository();
    const result = await new ListPersonNotesUseCase({
      personNoteRepository: repository,
    }).execute({ personId: 1, userId: 1 });

    expect(result).toEqual([
      {
        id: 3,
        note: "Minha nota",
        createdAt: "2026-01-01T11:00:00.000Z",
        updatedAt: "2026-01-01T11:00:00.000Z",
      },
    ]);
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

  it("updates caller-owned note", async () => {
    const repository = createRepository();
    const result = await new UpdatePersonNoteUseCase({
      personNoteRepository: repository,
    }).execute({
      personId: 1,
      noteId: 3,
      userId: 1,
      note: "Nota editada",
    });

    expect(result).toEqual({
      id: 3,
      note: "Nota editada",
      createdAt: "2026-01-01T11:00:00.000Z",
      updatedAt: "2026-01-03T10:00:00.000Z",
    });
  });

  it("404s update for another user's note", async () => {
    const repository = createRepository();
    await expect(
      new UpdatePersonNoteUseCase({
        personNoteRepository: repository,
      }).execute({
        personId: 1,
        noteId: 1,
        userId: 1,
        note: "hack",
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("deletes caller-owned note", async () => {
    const repository = createRepository();
    const result = await new DeletePersonNoteUseCase({
      personNoteRepository: repository,
    }).execute({ personId: 1, noteId: 3, userId: 1 });

    expect(result).toEqual({ id: 3, deleted: true });
    expect(repository.notes.find((n) => n.id === 3)).toBeUndefined();
  });

  it("404s delete for another user's note", async () => {
    const repository = createRepository();
    await expect(
      new DeletePersonNoteUseCase({
        personNoteRepository: repository,
      }).execute({ personId: 1, noteId: 1, userId: 1 })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    expect(repository.notes.find((n) => n.id === 1)).toBeDefined();
  });
});
