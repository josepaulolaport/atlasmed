import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { InvalidInviteError } from "../../../../../shared/errors";

import type {
  InviteRepository,
  CreateInviteParams,
  AcceptInviteTransactionParams,
  AcceptInviteTransactionResult,
} from "../../../application/interfaces/invite.repository.interface";

export class PrismaInviteRepository implements InviteRepository {
  async create(params: CreateInviteParams) {
    await this.cleanupExpired();

    return await prisma.invitation.create({
      data: {
        email: params.email ?? null,
        phoneNumber: params.phoneNumber ?? null,
        tokenHash: params.tokenHash,
        roleId: params.roleId,
        invitedByUserId: params.invitedByUserId,
        expiresAt: params.expiresAt,
      },
      include: {
        role: true,
      },
    });
  }

  async findValidByTokenHash(tokenHash: string) {
    return await prisma.invitation.findFirst({
      where: {
        tokenHash,

        status: "PENDING",

        revokedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },

      include: {
        role: true,
      },
    });
  }

  async findById(inviteId: string) {
    return await prisma.invitation.findUnique({
      where: { id: inviteId },
      include: {
        role: true,
      },
    });
  }

  async findByEmailOrPhone(email?: string | undefined, phoneNumber?: string | undefined) {
    if (!email && !phoneNumber) {
      return null;
    }

    return await prisma.invitation.findFirst({
      where: {
        OR: [
          email ? { email } : {},
          phoneNumber ? { phoneNumber } : {},
        ].filter(obj => Object.keys(obj).length > 0),
        status: "PENDING",
        revokedAt: null,
      },
      include: {
        role: true,
      },
    });
  }

  async findAll(params?: {
    status?: string;
    page?: number;
    limit?: number;
    invitedByUserId?: string;
  }) {
    await this.cleanupExpired();

    const page = params?.page ?? 1;
    const limit = Math.min(params?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = params?.status
      ? { status: params.status as any }
      : {};

    if (params?.invitedByUserId) {
      where.invitedByUserId = params.invitedByUserId;
    }

    const [invitations, total] = await Promise.all([
      prisma.invitation.findMany({
        where,
        include: {
          role: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.invitation.count({ where }),
    ]);

    return { invitations, total };
  }

  async markAccepted(inviteId: string, userId: string) {
    await prisma.invitation.update({
      where: {
        id: inviteId,
      },

      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });
  }

  async revoke(inviteId: string) {
    await prisma.invitation.update({
      where: {
        id: inviteId,
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });
  }

  async cleanupExpired(): Promise<number> {
    const result = await prisma.invitation.updateMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return result.count;
  }

  async acceptInviteTransaction(params: AcceptInviteTransactionParams): Promise<AcceptInviteTransactionResult> {
    return await prisma.$transaction(async (tx) => {
      // Pessimistic locking: Lock the invite row to prevent race conditions
      const lockedInvite = await tx.$queryRaw<Array<{ 
        id: string; 
        status: string; 
        expiresAt: Date;
        email: string | null;
        phoneNumber: string | null;
        roleId: string;
      }>>`
        SELECT id, status, "expiresAt", email, "phoneNumber", "roleId"
        FROM invitations
        WHERE "tokenHash" = ${params.tokenHash}
        FOR UPDATE
      `;

      if (!lockedInvite || lockedInvite.length === 0) {
        throw new InvalidInviteError();
      }

      const inviteLock = lockedInvite[0]!;

      // Validate invite status and expiration
      if (inviteLock.status !== "PENDING") {
        throw new InvalidInviteError("Invite has already been used");
      }

      if (inviteLock.expiresAt < new Date()) {
        throw new InvalidInviteError("Invite has expired");
      }

      // Validate email/phone matches
      if (inviteLock.email && inviteLock.email !== params.email) {
        throw new InvalidInviteError("Email does not match invitation");
      }

      if (inviteLock.phoneNumber && inviteLock.phoneNumber !== params.phoneNumber) {
        throw new InvalidInviteError("Phone number does not match invitation");
      }

      // Check for existing user with same credentials
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [
            { email: params.email },
            { username: params.username },
            params.phoneNumber ? { phoneNumber: params.phoneNumber } : {},
          ].filter(obj => Object.keys(obj).length > 0),
        },
      });

      if (existingUser) {
        throw new Error("User already exists");
      }

      // Create the user
      const user = await tx.user.create({
        data: {
          email: params.email,
          username: params.username,
          phoneNumber: params.phoneNumber ?? null,
          passwordHash: params.passwordHash,
          roleId: inviteLock.roleId,
          firstName: params.firstName ?? null,
          lastName: params.lastName ?? null,
          emailVerified: Boolean(inviteLock.email),
          phoneVerified: Boolean(inviteLock.phoneNumber),
          status: "ACTIVE",
        },
        include: {
          role: true,
        },
      });

      // Mark invite as accepted
      await tx.invitation.update({
        where: { id: inviteLock.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedByUserId: user.id,
        },
      });

      // Fetch the complete invite with role for the return value
      const invite = await tx.invitation.findUniqueOrThrow({
        where: { id: inviteLock.id },
        include: { role: true },
      });

      return { user, invite };
    });
  }
}
