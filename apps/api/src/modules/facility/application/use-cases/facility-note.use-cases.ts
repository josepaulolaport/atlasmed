import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope, ForbiddenError } from "@atlasmed/access";
import type { FacilityNoteRepository } from "../interfaces/facility-note.repository.interface";
import type { FacilityNoteRecord } from "../interfaces/facility-note.repository.interface";

interface Dependencies {
  facilityNoteRepository: FacilityNoteRepository;
}

function serializeFacilityNote(note: FacilityNoteRecord) {
  return {
    id: note.id,
    note: note.note,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export class ListFacilityNotesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    roleName?: string;
    ownerUserId?: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    const ownerUserId = input.ownerUserId ?? input.userId;
    if (
      ownerUserId !== input.userId &&
      (input.roleName !== "MANAGER" || !input.scope.managedUserIds.includes(ownerUserId))
    ) {
      throw new ForbiddenError("Facility note owner outside actor scope");
    }

    const notes = await this.deps.facilityNoteRepository.findByFacilityAndUser(
      input.facilityId,
      ownerUserId
    );

    return notes.map(serializeFacilityNote);
  }
}

export class CreateFacilityNoteUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    facilityId: string;
    userId: string;
    note: string;
    scope: ScopeContext;
  }) {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    return serializeFacilityNote(
      await this.deps.facilityNoteRepository.create({
        facilityId: input.facilityId,
        userId: input.userId,
        note: input.note,
      })
    );
  }
}
