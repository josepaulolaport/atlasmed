import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { PrismaUserRepository } from "./prisma-user.repository";
import type { CreateUserParams } from "../../../application/interfaces/user.repository.interface";
import { cleanTestData } from "../../../../../test-utils/database-helpers";
import { createTestUserParams } from "../../../../../test-utils/user-test-helpers";

describe("PrismaUserRepository (Integration)", () => {
  let userRepository: PrismaUserRepository;
  let testRoleId: string;

  beforeAll(async () => {
    // Use existing seeded role instead of creating a new one
    const testRole = await prisma.role.findUnique({
      where: { name: "USER" },
    });
    
    if (!testRole) {
      throw new Error("USER role not found in seeded database");
    }
    
    testRoleId = testRole.id;
  });

  afterAll(async () => {
    // Clean up test data but don't delete the seeded role
    await prisma.user.deleteMany({
      where: {
        email: { contains: "test" },
      },
    });
  });

  beforeEach(async () => {
    await cleanTestData(prisma);
    userRepository = new PrismaUserRepository();
  });

  describe("create", () => {
    it("should create user with email", async () => {
      const params = createTestUserParams(testRoleId);

      const user = await userRepository.create(params);

      expect(user).toBeDefined();
      expect(user.email).toBe(params.email);
      expect(user.username).toBe(params.username);
    });

    it("should create user with phone number", async () => {
      const params = createTestUserParams(testRoleId, {
        phoneNumber: "+1234567890",
      });

      const user = await userRepository.create(params);

      expect(user.phoneNumber).toBe("+1234567890");
    });

    it("should create user with firstName and lastName", async () => {
      const params = createTestUserParams(testRoleId, {
        firstName: "John",
        lastName: "Doe",
      });

      const user = await userRepository.create(params);

      expect(user.firstName).toBe("John");
      expect(user.lastName).toBe("Doe");
    });

    it("should include role in created user", async () => {
      const params = createTestUserParams(testRoleId);

      const user = await userRepository.create(params);

      expect(user.role).toBeDefined();
      expect(user.role.id).toBe(testRoleId);
    });

    it("should set default status to PENDING", async () => {
      const params = createTestUserParams(testRoleId);

      const user = await userRepository.create(params);

      expect(user.status).toBe("PENDING");
    });

    it("should allow custom status", async () => {
      const params = createTestUserParams(testRoleId, {
        status: "ACTIVE",
      });

      const user = await userRepository.create(params);

      expect(user.status).toBe("ACTIVE");
    });
  });

  describe("findByIdentifier", () => {
    beforeEach(async () => {
      await userRepository.create({
        email: "user@example.com",
        username: createTestUserParams(testRoleId).username,
        phoneNumber: "+1234567890",
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });
    });

    it("should find user by email", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "user@example.com",
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe("user@example.com");
    });

    it("should find user by username", async () => {
      // First create a user to find
      const params = createTestUserParams(testRoleId);
      await userRepository.create(params);

      const user = await userRepository.findByIdentifier({
        identifier: params.username,
      });

      expect(user).not.toBeNull();
      expect(user?.username).toBe(params.username);
    });

    it("should find user by phone number", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "+1234567890",
      });

      expect(user).not.toBeNull();
      expect(user?.phoneNumber).toBe("+1234567890");
    });

    it("should return null when user not found", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "nonexistent@example.com",
      });

      expect(user).toBeNull();
    });

    it("should include role when user found", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "user@example.com",
      });

      expect(user?.role).toBeDefined();
      expect(user?.role.id).toBe(testRoleId);
    });
  });

  describe("findById", () => {
    it("should find user by ID", async () => {
      const created = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      const user = await userRepository.findById(created.id);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(created.id);
    });

    it("should include role when user found", async () => {
      const created = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      const user = await userRepository.findById(created.id);

      expect(user?.role).toBeDefined();
      expect(user?.role.id).toBe(testRoleId);
    });

    it("should return null when user not found", async () => {
      const user = await userRepository.findById("non-existent-id");

      expect(user).toBeNull();
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login timestamp", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      const before = user.lastLoginAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await userRepository.updateLastLogin(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.lastLoginAt).not.toEqual(before);
      expect(updated?.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe("deactivate", () => {
    it("should set user status to INACTIVE", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.deactivate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("INACTIVE");
    });

    it("should set deactivatedAt timestamp", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.deactivate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.deactivatedAt).toBeInstanceOf(Date);
    });
  });

  describe("activate", () => {
    it("should set user status to ACTIVE", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "INACTIVE",
      });

      await userRepository.activate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("ACTIVE");
    });

    it("should clear deactivatedAt timestamp", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "INACTIVE",
      });

      await userRepository.deactivate(user.id);
      await userRepository.activate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.deactivatedAt).toBeNull();
    });
  });

  describe("suspend", () => {
    it("should set user status to SUSPENDED", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.suspend(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("SUSPENDED");
    });
  });

  describe("unsuspend", () => {
    it("should set user status to ACTIVE", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "SUSPENDED",
      });

      await userRepository.unsuspend(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("ACTIVE");
    });
  });

  describe("delete", () => {
    it("should delete user", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      await userRepository.delete(user.id);

      const deleted = await userRepository.findById(user.id);

      expect(deleted).toBeNull();
    });
  });
});
