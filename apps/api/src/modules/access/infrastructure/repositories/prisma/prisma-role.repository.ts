import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type { RoleRepository } from "../../../application/interfaces/role.repository.interface";

export class PrismaRoleRepository implements RoleRepository {
  async findById(roleId: string) {
    return await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        priority: true,
      },
    });
  }

  async findAll() {
    return await prisma.role.findMany({
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
  }
}
