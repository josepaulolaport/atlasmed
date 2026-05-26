import { describe, expect, it } from "bun:test";

import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { PrismaRoleRepository } from "./prisma-role.repository";

describe("PrismaRoleRepository", () => {
  describe("findAll", () => {
    it("should return roles ordered by priority ascending", async () => {
      const repository = new PrismaRoleRepository();

      const result = await repository.findAll();
      const expected = await prisma.role.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
        },
        orderBy: {
          priority: "asc",
        },
      });

      expect(result).toEqual(expected);

      for (let index = 1; index < result.length; index++) {
        expect(result[index]!.priority).toBeGreaterThanOrEqual(result[index - 1]!.priority);
      }
    });
  });
});
