import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type { ScopeRepository } from "../../../application/interfaces/scope.repository.interface";

export class PrismaScopeRepository implements ScopeRepository {
  async findTerritoryIdsByUserId(userId: string): Promise<string[]> {
    const assignments = await prisma.userTerritoryAssignment.findMany({
      where: { userId },
      select: { territoryId: true },
    });

    return assignments.map((assignment) => assignment.territoryId);
  }

  async findTerritoryIdsByUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }

    const assignments = await prisma.userTerritoryAssignment.findMany({
      where: {
        userId: { in: userIds },
      },
      select: { territoryId: true },
    });

    return assignments.map((assignment) => assignment.territoryId);
  }

  async findManagedUserIds(managerId: string): Promise<string[]> {
    const reports = await prisma.user.findMany({
      where: {
        managerId,
        deletedAt: null,
      },
      select: { id: true },
    });

    return reports.map((report) => report.id);
  }

  async assignTerritory(params: {
    userId: string;
    territoryId: string;
    assignedBy: string;
  }): Promise<void> {
    await prisma.userTerritoryAssignment.upsert({
      where: {
        userId_territoryId: {
          userId: params.userId,
          territoryId: params.territoryId,
        },
      },
      create: {
        userId: params.userId,
        territoryId: params.territoryId,
        assignedBy: params.assignedBy,
      },
      update: {
        assignedBy: params.assignedBy,
      },
    });
  }

  async revokeTerritory(params: {
    userId: string;
    territoryId: string;
  }): Promise<void> {
    await prisma.userTerritoryAssignment.deleteMany({
      where: {
        userId: params.userId,
        territoryId: params.territoryId,
      },
    });
  }

  async findTerritoryAssignmentsByUserId(userId: string): Promise<
    Array<{
      territoryId: string;
      assignedAt: Date;
    }>
  > {
    const assignments = await prisma.userTerritoryAssignment.findMany({
      where: { userId },
      select: {
        territoryId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return assignments.map((assignment) => ({
      territoryId: assignment.territoryId,
      assignedAt: assignment.createdAt,
    }));
  }

  async findManagerIdByUserId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { managerId: true },
    });

    return user?.managerId ?? null;
  }
}
