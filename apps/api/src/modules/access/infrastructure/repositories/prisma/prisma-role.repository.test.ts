import { describe, expect, it } from "bun:test";
import { asc } from "drizzle-orm";
import { roles } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import { PrismaRoleRepository } from "./prisma-role.repository";

describe("PrismaRoleRepository", () => {
  describe("findAll", () => {
    it("should return roles ordered by priority ascending", async () => {
      const repository = new PrismaRoleRepository();

      const result = await repository.findAll();
      const expected = await db
        .select({
          id: roles.id,
          name: roles.name,
          description: roles.description,
          priority: roles.priority,
        })
        .from(roles)
        .orderBy(asc(roles.priority));

      expect(result).toEqual(expected);

      for (let index = 1; index < result.length; index++) {
        expect(result[index]!.priority).toBeGreaterThanOrEqual(result[index - 1]!.priority);
      }
    });
  });
});
