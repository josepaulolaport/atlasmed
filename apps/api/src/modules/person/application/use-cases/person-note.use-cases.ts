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
