import { RELATIONSHIP_LEVEL_MAX } from "@atlasmed/database";
import { ResourceNotFoundError } from "../../../../shared/errors";
import type { UserPersonRelationshipRepository } from "../interfaces/user-person-relationship.repository.interface";

interface Dependencies {
  userPersonRelationshipRepository: UserPersonRelationshipRepository;
}

async function assertActivePerson(
  repository: UserPersonRelationshipRepository,
  personId: number
) {
  const person = await repository.findActivePersonById(personId);
  if (!person) {
    throw new ResourceNotFoundError("Person", personId);
  }
}

/** User-scoped relationship score — no territory scope. */
export class GetUserPersonRelationshipUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: { personId: number; userId: number }) {
    await assertActivePerson(
      this.deps.userPersonRelationshipRepository,
      input.personId
    );

    const row =
      await this.deps.userPersonRelationshipRepository.findByUserAndPerson(
        input.userId,
        input.personId
      );

    return {
      personId: input.personId,
      relationshipLevel: row?.relationshipLevel ?? null,
    };
  }
}

/** User-scoped upsert — no territory scope. */
export class UpsertUserPersonRelationshipUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    personId: number;
    userId: number;
    relationshipLevel: number;
  }) {
    await assertActivePerson(
      this.deps.userPersonRelationshipRepository,
      input.personId
    );

    const row = await this.deps.userPersonRelationshipRepository.upsert({
      userId: input.userId,
      personId: input.personId,
      relationshipLevel: input.relationshipLevel,
    });

    return {
      personId: row.personId,
      relationshipLevel: row.relationshipLevel,
      isPriority: row.relationshipLevel === RELATIONSHIP_LEVEL_MAX,
    };
  }
}
