import { describe, expect, it } from "bun:test";
import { ResourceNotFoundError, ValidationError } from "../../../../shared/errors";
import type {
  UserPersonRelationshipRecord,
  UserPersonRelationshipRepository,
} from "../interfaces/user-person-relationship.repository.interface";
import {
  GetUserPersonRelationshipUseCase,
  UpsertUserPersonRelationshipUseCase,
} from "./user-person-relationship.use-cases";

function createRepository(options?: {
  personExists?: boolean;
}): UserPersonRelationshipRepository & {
  rows: Map<string, UserPersonRelationshipRecord>;
} {
  const rows = new Map<string, UserPersonRelationshipRecord>();
  const key = (userId: number, personId: number) => `${userId}:${personId}`;

  return {
    rows,
    findActivePersonById: async (personId) =>
      options?.personExists === false || personId !== 1
        ? null
        : { id: personId },
    findByUserAndPerson: async (userId, personId) =>
      rows.get(key(userId, personId)) ?? null,
    findLevelsByUserAndPersons: async () => new Map(),
    upsert: async (params) => {
      if (
        !Number.isInteger(params.relationshipLevel) ||
        params.relationshipLevel < 1 ||
        params.relationshipLevel > 10
      ) {
        throw new ValidationError([
          {
            field: "relationshipLevel",
            message: "Must be an integer between 1 and 10",
          },
        ]);
      }
      const existing = rows.get(key(params.userId, params.personId));
      const row: UserPersonRelationshipRecord = {
        id: existing?.id ?? 1,
        userId: params.userId,
        personId: params.personId,
        relationshipLevel: params.relationshipLevel,
        createdAt: existing?.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      };
      rows.set(key(params.userId, params.personId), row);
      return row;
    },
  };
}

describe("user person relationship use cases", () => {
  it("returns null relationshipLevel when none stored", async () => {
    const repository = createRepository();
    const result = await new GetUserPersonRelationshipUseCase({
      userPersonRelationshipRepository: repository,
    }).execute({ personId: 1, userId: 9 });

    expect(result).toEqual({ personId: 1, relationshipLevel: null });
  });

  it("upserts relationship and marks priority at level 10", async () => {
    const repository = createRepository();
    const useCase = new UpsertUserPersonRelationshipUseCase({
      userPersonRelationshipRepository: repository,
    });

    const created = await useCase.execute({
      personId: 1,
      userId: 9,
      relationshipLevel: 7,
    });
    expect(created).toEqual({
      personId: 1,
      relationshipLevel: 7,
      isPriority: false,
    });

    const updated = await useCase.execute({
      personId: 1,
      userId: 9,
      relationshipLevel: 10,
    });
    expect(updated).toEqual({
      personId: 1,
      relationshipLevel: 10,
      isPriority: true,
    });

    const fetched = await new GetUserPersonRelationshipUseCase({
      userPersonRelationshipRepository: repository,
    }).execute({ personId: 1, userId: 9 });
    expect(fetched.relationshipLevel).toBe(10);
  });

  it("rejects upsert when person is missing or deleted", async () => {
    const repository = createRepository({ personExists: false });

    await expect(
      new UpsertUserPersonRelationshipUseCase({
        userPersonRelationshipRepository: repository,
      }).execute({
        personId: 1,
        userId: 9,
        relationshipLevel: 5,
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
