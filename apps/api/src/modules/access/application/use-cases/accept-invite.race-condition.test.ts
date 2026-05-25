import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { hash } from "argon2";
import { prisma } from "../../../../infrastructure/database/prisma.client";
import { AcceptInviteUseCase } from "./accept-invite.use-case";
import { PrismaInviteRepository } from "../../infrastructure/repositories/prisma/prisma-invite.repository";
import { PrismaUserRepository } from "../../infrastructure/repositories/prisma/prisma-user.repository";
import { InviteUserUseCase } from "./invite-user.use-case";
import { getUniqueTestId } from "../../../../test-utils/database-helpers";

describe("Accept Invite Race Condition Integration Tests", () => {
  let inviteRepository: PrismaInviteRepository;
  let userRepository: PrismaUserRepository;
  let acceptInviteUseCase: AcceptInviteUseCase;
  let inviteUserUseCase: InviteUserUseCase;
  let adminUserId: string;
  let roleId: string;

  beforeAll(async () => {
    inviteRepository = new PrismaInviteRepository();
    userRepository = new PrismaUserRepository();

    acceptInviteUseCase = new AcceptInviteUseCase({
      inviteRepository,
    });

    inviteUserUseCase = new InviteUserUseCase({
      inviteRepository,
      userRepository,
    });

    const role = await prisma.role.findFirst({
      where: { name: "USER" },
    });

    if (!role) {
      throw new Error("USER role not found in database");
    }

    roleId = role.id;

    // Create a dedicated admin user for this test suite
    const uniqueId = getUniqueTestId();
    const passwordHash = await hash("AdminPassword123!");

    const adminUser = await prisma.user.create({
      data: {
        email: `invite_admin_${uniqueId}@example.com`,
        username: `invite_admin_${uniqueId}`,
        passwordHash,
        firstName: "Invite",
        lastName: "Admin",
        roleId: role.id,
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    adminUserId = adminUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.invitation.deleteMany({ where: { invitedByUserId: adminUserId } });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: adminUserId },
          { email: { contains: "race-test" } },
        ],
      },
    });
    await prisma.$disconnect();
  });

  test("should prevent race condition when accepting invite with same username", async () => {
    const email = `race-test-${Date.now()}@example.com`;
    const username = `raceuser${Date.now()}`;

    const invite = await inviteUserUseCase.execute({
      email,
      roleId,
      invitedByUserId: adminUserId,
    });

    const params = {
      token: invite.token,
      email,
      username,
      password: "Password123!",
      firstName: "Race",
      lastName: "Test",
    };

    const results = await Promise.allSettled([
      acceptInviteUseCase.execute(params),
      acceptInviteUseCase.execute(params),
      acceptInviteUseCase.execute(params),
    ]);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(2);

    const usersWithUsername = await prisma.user.count({
      where: { username },
    });

    expect(usersWithUsername).toBe(1);
  });

  test("should prevent race condition with same email", async () => {
    const email = `race-email-${Date.now()}@example.com`;
    const username1 = `user1-${Date.now()}`;
    const username2 = `user2-${Date.now()}`;
    const username3 = `user3-${Date.now()}`;

    const invite1 = await inviteUserUseCase.execute({
      email: `${email}1`,
      roleId,
      invitedByUserId: adminUserId,
    });

    const invite2 = await inviteUserUseCase.execute({
      email: `${email}2`,
      roleId,
      invitedByUserId: adminUserId,
    });

    const invite3 = await inviteUserUseCase.execute({
      email: `${email}3`,
      roleId,
      invitedByUserId: adminUserId,
    });

    const sharedEmail = `shared-${Date.now()}@example.com`;

    const results = await Promise.allSettled([
      acceptInviteUseCase.execute({
        token: invite1.token,
        email: sharedEmail,
        username: username1,
        password: "Password123!",
      }),
      acceptInviteUseCase.execute({
        token: invite2.token,
        email: sharedEmail,
        username: username2,
        password: "Password123!",
      }),
      acceptInviteUseCase.execute({
        token: invite3.token,
        email: sharedEmail,
        username: username3,
        password: "Password123!",
      }),
    ]);

    const successCount = results.filter((r) => r.status === "fulfilled").length;

    expect(successCount).toBe(1);

    const usersWithEmail = await prisma.user.count({
      where: { email: sharedEmail },
    });

    expect(usersWithEmail).toBe(1);
  });

  test("should allow sequential accept invites with different credentials", async () => {
    const email1 = `seq1-${Date.now()}@example.com`;
    const email2 = `seq2-${Date.now()}@example.com`;
    const username1 = `sequser1-${Date.now()}`;
    const username2 = `sequser2-${Date.now()}`;

    const invite1 = await inviteUserUseCase.execute({
      email: email1,
      roleId,
      invitedByUserId: adminUserId,
    });

    const invite2 = await inviteUserUseCase.execute({
      email: email2,
      roleId,
      invitedByUserId: adminUserId,
    });

    const user1 = await acceptInviteUseCase.execute({
      token: invite1.token,
      email: email1,
      username: username1,
      password: "Password123!",
    });

    expect(user1).toBeDefined();
    expect(user1.username).toBe(username1);

    const user2 = await acceptInviteUseCase.execute({
      token: invite2.token,
      email: email2,
      username: username2,
      password: "Password123!",
    });

    expect(user2).toBeDefined();
    expect(user2.username).toBe(username2);
  });
});
