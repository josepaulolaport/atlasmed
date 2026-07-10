import { eq, asc } from "drizzle-orm";
import { roles } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type { RoleRepository } from "../../../application/interfaces/role.repository.interface";

export class PrismaRoleRepository implements RoleRepository {
  async findById(roleId: string) {
    const [row] = await db
      .select({
        id: roles.id,
        name: roles.name,
        priority: roles.priority,
      })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    return row ?? null;
  }

  async findAll() {
    return await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        priority: roles.priority,
      })
      .from(roles)
      .orderBy(asc(roles.priority));
  }
}
