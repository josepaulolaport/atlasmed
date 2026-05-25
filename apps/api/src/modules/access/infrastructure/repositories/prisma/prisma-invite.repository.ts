import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { InvalidInviteError } from "@atlasmed/access";

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
      const invite = await tx.invitation.findFirst({
        where: {
          tokenHash: params.tokenHash,
          status: "PENDING",
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          role: true,
        },
      });

      if (!invite) {
        throw new InvalidInviteError();
      }

      if (invite.email && invite.email !== params.email) {
        throw new InvalidInviteError("Email does not match invitation");
      }

      if (invite.phoneNumber && invite.phoneNumber !== params.phoneNumber) {
        throw new InvalidInviteError("Phone number does not match invitation");
      }

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

      const user = await tx.user.create({
        data: {
          email: params.email,
          username: params.username,
          phoneNumber: params.phoneNumber ?? null,
          passwordHash: params.passwordHash,
          roleId: invite.roleId,
          firstName: params.firstName ?? null,
          lastName: params.lastName ?? null,
          emailVerified: Boolean(invite.email),
          phoneVerified: Boolean(invite.phoneNumber),
          status: "ACTIVE",
        },
        include: {
          role: true,
        },
      });

      await tx.invitation.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      return { user, invite };
    });
  }
}
