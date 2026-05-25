import { beforeEach, afterEach, describe, expect, it, mock } from "bun:test";
import { LoginUseCase } from "./login.use-case";
import { InvalidCredentialsError } from "@atlasmed/access";
import { PasswordService } from "../services/password.service";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { createMockUserRepository, createMockSessionRepository, createMockSessionCache } from "../../test-helpers/fixtures";
import { resetAllMocks } from "../../../../test-utils/mock-reset";

describe("LoginUseCase", () => {
  let loginUseCase: LoginUseCase;
  let mockUserRepository: UserRepository;
  let mockSessionRepository: SessionRepository;
  let mockSessionCache: ISessionCache;
  let mockRedis: any;
  let passwordService: PasswordService;
  let validPasswordHash: string;

  const createMockUser = () => ({
    id: "user-123",
    email: "user@example.com",
    username: "testuser",
    phoneNumber: null,
    passwordHash: validPasswordHash,
    roleId: "role-123",
    firstName: "Test",
    lastName: "User",
    status: "ACTIVE",
    emailVerified: true,
    phoneVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deactivatedAt: null,
    role: {
      id: "role-123",
      name: "USER",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  beforeEach(async () => {
    passwordService = new PasswordService();
    validPasswordHash = await passwordService.hash("secure-password");

    const mockUser = createMockUser();

    mockUserRepository = createMockUserRepository({
      findByIdentifier: mock(async () => mockUser),
      findById: mock(async () => mockUser),
      updateLastLogin: mock(async () => {}),
    });

    mockSessionRepository = createMockSessionRepository({
      create: mock(async (params) => ({
        id: params.id,
        userId: params.userId,
        refreshTokenHash: params.refreshTokenHash,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        expiresAt: params.expiresAt,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        revokedAt: null,
        revokedReason: null,
      })),
    });

    mockRedis = {
      get: mock(async () => null),
      setex: mock(async () => "OK"),
      del: mock(async () => 1),
      incr: mock(async () => 1),
      expire: mock(async () => 1),
      ttl: mock(async () => -1),
    };

    mockSessionCache = createMockSessionCache();

    loginUseCase = new LoginUseCase({
      userRepository: mockUserRepository,
      sessionRepository: mockSessionRepository,
      sessionCache: mockSessionCache,
      redis: mockRedis,
    });
  });

  afterEach(() => {
    // Clean up mocks after each test
    resetAllMocks(mockUserRepository, mockSessionRepository, mockSessionCache, mockRedis);
    mock.restore();
  });

  describe("successful login", () => {
    it("should login with valid email and password", async () => {
      const params = {
        identifier: "user@example.com",
        password: "secure-password",
      };

      const result = await loginUseCase.execute(params);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("user");
    });

    it("should login with valid username and password", async () => {
      const params = {
        identifier: "testuser",
        password: "secure-password",
      };

      const result = await loginUseCase.execute(params);

      expect(result.user.username).toBe("testuser");
    });

    it("should return access token as string", async () => {
      const result = await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
      });

      expect(result.accessToken).toBeString();
      expect(result.accessToken.split(".")).toHaveLength(3);
    });

    it("should return refresh token as string", async () => {
      const result = await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
      });

      expect(result.refreshToken).toBeString();
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it("should return user object", async () => {
      const result = await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
      });

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe("user-123");
      expect(result.user.email).toBe("user@example.com");
      expect(result.user.username).toBe("testuser");
    });

    it("should create a session", async () => {
      await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
      });

      expect(mockSessionRepository.create).toHaveBeenCalledTimes(1);
    });

    it("should update last login timestamp", async () => {
      await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
      });

      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith("user-123");
    });

    it("should include ipAddress in session", async () => {
      const ipAddress = "192.168.1.1";

      await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
        ipAddress,
      });

      const createCall = (mockSessionRepository.create as any).mock.calls[0][0];
      expect(createCall.ipAddress).toBe(ipAddress);
    });

    it("should include userAgent in session", async () => {
      const userAgent = "Mozilla/5.0";

      await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
        userAgent,
      });

      const createCall = (mockSessionRepository.create as any).mock.calls[0][0];
      expect(createCall.userAgent).toBe(userAgent);
    });
  });

  describe("invalid credentials", () => {
    it("should throw InvalidCredentialsError when user not found", async () => {
      mockUserRepository.findByIdentifier = mock(async () => null);

      await expect(
        loginUseCase.execute({
          identifier: "nonexistent@example.com",
          password: "password",
        })
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("should throw InvalidCredentialsError with wrong password", async () => {
      await expect(
        loginUseCase.execute({
          identifier: "user@example.com",
          password: "wrong-password",
        })
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("should not create session when user not found", async () => {
      mockUserRepository.findByIdentifier = mock(async () => null);

      try {
        await loginUseCase.execute({
          identifier: "nonexistent@example.com",
          password: "password",
        });
      } catch {}

      expect(mockSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should not create session with wrong password", async () => {
      try {
        await loginUseCase.execute({
          identifier: "user@example.com",
          password: "wrong-password",
        });
      } catch {}

      expect(mockSessionRepository.create).not.toHaveBeenCalled();
    });

    it("should not update last login when user not found", async () => {
      mockUserRepository.findByIdentifier = mock(async () => null);

      try {
        await loginUseCase.execute({
          identifier: "nonexistent@example.com",
          password: "password",
        });
      } catch {}

      expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
    });

    it("should not update last login with wrong password", async () => {
      try {
        await loginUseCase.execute({
          identifier: "user@example.com",
          password: "wrong-password",
        });
      } catch {}

      expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
    });
  });

  describe("repository failures", () => {
    it("should propagate error when findByIdentifier fails", async () => {
      const repositoryError = new Error("Database connection failed");
      mockUserRepository.findByIdentifier = mock(async () => {
        throw repositoryError;
      });

      await expect(
        loginUseCase.execute({
          identifier: "user@example.com",
          password: "password",
        })
      ).rejects.toThrow("Database connection failed");
    });

    it("should propagate error when updateLastLogin fails", async () => {
      const repositoryError = new Error("Update failed");
      mockUserRepository.updateLastLogin = mock(async () => {
        throw repositoryError;
      });

      await expect(
        loginUseCase.execute({
          identifier: "user@example.com",
          password: "secure-password",
        })
      ).rejects.toThrow("Update failed");
    });

    it("should propagate error when session creation fails", async () => {
      const repositoryError = new Error("Session creation failed");
      mockSessionRepository.create = mock(async () => {
        throw repositoryError;
      });

      await expect(
        loginUseCase.execute({
          identifier: "user@example.com",
          password: "secure-password",
        })
      ).rejects.toThrow("Session creation failed");
    });
  });

  describe("user lookup", () => {
    it("should call findByIdentifier with correct identifier", async () => {
      const identifier = "user@example.com";

      await loginUseCase.execute({
        identifier,
        password: "secure-password",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalledWith({
        identifier,
      });
    });

    it("should support email identifier", async () => {
      await loginUseCase.execute({
        identifier: "user@example.com",
        password: "secure-password",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalled();
    });

    it("should support username identifier", async () => {
      await loginUseCase.execute({
        identifier: "testuser",
        password: "secure-password",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalled();
    });

    it("should support phone number identifier", async () => {
      await loginUseCase.execute({
        identifier: "+1234567890",
        password: "secure-password",
      });

      expect(mockUserRepository.findByIdentifier).toHaveBeenCalled();
    });
  });
});
