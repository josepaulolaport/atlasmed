import { ResourceNotFoundError } from "../../../../shared/errors";
import type {
  PersonNoteRecord,
  PersonNoteRepository,
} from "../interfaces/person-note.repository.interface";

interface Dependencies {
  personNoteRepository: PersonNoteRepository;
}

function serializePersonNote(note: PersonNoteRecord) {
  return {
    id: note.id,
    note: note.note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function assertActivePerson(
  repository: PersonNoteRepository,
  personId: number
) {
  const person = await repository.findActivePersonById(personId);
  if (!person) {
    throw new ResourceNotFoundError("Person", personId);
  }
}

/** Caller-owned notes only — no territory scope (user-scoped privacy). */
export class ListPersonNotesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number; userId: number }) {
    await assertActivePerson(this.deps.personNoteRepository, input.personId);

    const notes = await this.deps.personNoteRepository.findByPersonAndUser(
      input.personId,
      input.userId
    );

    return notes.map(serializePersonNote);
  }
}

/** Caller-owned notes only — no territory scope (user-scoped privacy). */
export class CreatePersonNoteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number; userId: number; note: string }) {
    await assertActivePerson(this.deps.personNoteRepository, input.personId);

    return serializePersonNote(
      await this.deps.personNoteRepository.create({
        personId: input.personId,
        userId: input.userId,
        note: input.note,
      })
    );
  }
}

/** Caller-owned hard update — 404 if note missing or owned by another user. */
export class UpdatePersonNoteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    personId: number;
    noteId: number;
    userId: number;
    note: string;
  }) {
    await assertActivePerson(this.deps.personNoteRepository, input.personId);

    const updated = await this.deps.personNoteRepository.updateOwned({
      noteId: input.noteId,
      personId: input.personId,
      userId: input.userId,
      note: input.note,
    });
    if (!updated) {
      throw new ResourceNotFoundError("PersonNote", input.noteId);
    }
    return serializePersonNote(updated);
  }
}

/** Caller-owned hard delete — 404 if note missing or owned by another user. */
export class DeletePersonNoteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number; noteId: number; userId: number }) {
    await assertActivePerson(this.deps.personNoteRepository, input.personId);

    const deleted = await this.deps.personNoteRepository.deleteOwned({
      noteId: input.noteId,
      personId: input.personId,
      userId: input.userId,
    });
    if (!deleted) {
      throw new ResourceNotFoundError("PersonNote", input.noteId);
    }
    return { id: input.noteId, deleted: true as const };
  }
}
