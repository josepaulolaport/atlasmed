import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { hash } from "argon2";
import { eq, or, like, sql } from "drizzle-orm";
import { roles, users, invitations } from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";
import { AcceptInviteUseCase } from "./accept-invite.use-case";
import { DrizzleInviteRepository } from "../../infrastructure/repositories/drizzle/drizzle-invite.repository";
import { DrizzleUserRepository } from "../../infrastructure/repositories/drizzle/drizzle-user.repository";
import { DrizzleRoleRepository } from "../../infrastructure/repositories/drizzle/drizzle-role.repository";
import { accessUseCases } from "../../composition";
import { getUniqueTestId } from "../../../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../../../test-utils/integration-database";

/**
 * RACE CONDITION TESTS WITH PESSIMISTIC LOCKING
 * 
 * These tests verify that concurrent invite acceptances with duplicate usernames/emails
 * are properly handled using pessimistic locking (SELECT FOR UPDATE).
 * 
 * The acceptInviteTransaction locks the invite row, ensuring only one concurrent
 * request can process each invite. Other requests will wait for the lock and then
 * fail when they see the invite status is no longer PENDING.
 */
describe("Accept Invite Race Condition Integration Tests", () => {
  let dbReady = false;
  let inviteRepository: DrizzleInviteRepository;
  let userRepository: DrizzleUserRepository;
  let roleRepository: DrizzleRoleRepository;
  let acceptInviteUseCase: AcceptInviteUseCase;
  let inviteUser: ReturnType<typeof accessUseCases.inviteUser>;
  let adminUserId: string;
  let roleId: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    inviteRepository = new DrizzleInviteRepository();
    userRepository = new DrizzleUserRepository();
    roleRepository = new DrizzleRoleRepository();

    acceptInviteUseCase = accessUseCases.acceptInvite();

    inviteUser = accessUseCases.inviteUser();

    const role = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "REP"))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!role) {
      throw new Error("USER role not found in database");
    }

    roleId = role.id;

    const uniqueId = getUniqueTestId();
    const passwordHash = await hash("AdminPassword123!");

    const adminUser = await db
      .insert(users)
      .values({
        email: `invite_admin_${uniqueId}@example.com`,
        username: `invite_admin_${uniqueId}`,
        passwordHash,
        firstName: "Invite",
        lastName: "Admin",
        roleId: role.id,
        status: "ACTIVE",
        emailVerified: true,
      })
      .returning()
      .then((r) => r[0]!);

    adminUserId = adminUser.id;
  });

  afterAll(async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    await db.delete(invitations).where(eq(invitations.invitedByUserId, adminUserId));
    await db
      .delete(users)
      .where(
        or(
          eq(users.id, adminUserId),
          like(users.email, "%race-test%"),
        ),
      );
  });

  test("should prevent race condition when accepting invite with same username", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const email = `race-test-${Date.now()}@example.com`;
    const username = `raceuser${Date.now()}`;

    const invite = await inviteUser.execute({
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

    const usersWithUsername = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.username, username))
      .then((r) => Number(r[0]?.count ?? 0));

    expect(usersWithUsername).toBe(1);
  });

  test("should prevent race condition with same email", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");
    const phone1 = `+1555${Date.now()}1`;
    const phone2 = `+1555${Date.now()}2`;
    const phone3 = `+1555${Date.now()}3`;
    const username1 = `user1-${Date.now()}`;
    const username2 = `user2-${Date.now()}`;
    const username3 = `user3-${Date.now()}`;

    // Create invites with phone numbers (no email) so users can choose any email during acceptance
    const invite1 = await inviteUser.execute({
      phoneNumber: phone1,
      roleId,
      invitedByUserId: adminUserId,
    });

    const invite2 = await inviteUser.execute({
      phoneNumber: phone2,
      roleId,
      invitedByUserId: adminUserId,
    });

    const invite3 = await inviteUser.execute({
      phoneNumber: phone3,
      roleId,
      invitedByUserId: adminUserId,
    });

    const sharedEmail = `shared-${Date.now()}@example.com`;

    // All 3 try to accept with the same email - race condition
    const results = await Promise.allSettled([
      acceptInviteUseCase.execute({
        token: invite1.token,
        email: sharedEmail,
        phoneNumber: phone1,
        username: username1,
        password: "Password123!",
      }),
      acceptInviteUseCase.execute({
        token: invite2.token,
        email: sharedEmail,
        phoneNumber: phone2,
        username: username2,
        password: "Password123!",
      }),
      acceptInviteUseCase.execute({
        token: invite3.token,
        email: sharedEmail,
        phoneNumber: phone3,
        username: username3,
        password: "Password123!",
      }),
    ]);

    const successCount = results.filter((r) => r.status === "fulfilled").length;

    expect(successCount).toBe(1);

    const usersWithEmail = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.email, sharedEmail))
      .then((r) => Number(r[0]?.count ?? 0));

    expect(usersWithEmail).toBe(1);
  });

  test("should allow sequential accept invites with different credentials", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");
    const email1 = `seq1-${Date.now()}@example.com`;
    const email2 = `seq2-${Date.now()}@example.com`;
    const username1 = `sequser1-${Date.now()}`;
    const username2 = `sequser2-${Date.now()}`;

    const invite1 = await inviteUser.execute({
      email: email1,
      roleId,
      invitedByUserId: adminUserId,
    });

    const invite2 = await inviteUser.execute({
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
