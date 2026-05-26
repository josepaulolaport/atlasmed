import { describe, expect, it, mock } from "bun:test";

import { ListRolesUseCase } from "./list-roles.use-case";
import { createMockRoleRepository } from "../../test-helpers/repository-mocks";

describe("ListRolesUseCase", () => {
  it("should return roles without priority field", async () => {
    const roleRepository = createMockRoleRepository({
      findAll: mock(() =>
        Promise.resolve([
          {
            id: "role-1",
            name: "USER",
            description: "Standard user",
            priority: 10,
          },
        ])
      ),
    });

    const useCase = new ListRolesUseCase({ roleRepository });
    const result = await useCase.execute();

    expect(result).toEqual({
      roles: [
        {
          id: "role-1",
          name: "USER",
          description: "Standard user",
        },
      ],
    });
  });
});
