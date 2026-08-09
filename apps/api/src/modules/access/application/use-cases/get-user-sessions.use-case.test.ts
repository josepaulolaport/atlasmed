import { beforeEach, describe, expect, it, mock } from "bun:test";
import { GetUserSessionsUseCase } from "./get-user-sessions.use-case";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import { createMockSessionRepository } from "../../test-helpers/fixtures";

describe("GetUserSessionsUseCase", () => {
  let useCase: GetUserSessionsUseCase;
  let mockSessionRepository: SessionRepository;

  const sessions = [
    {
      id: 1,
      userId: 123,
      refreshTokenHash: "hash-1",
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0 (Macintosh)",
      deviceFingerprint: "fp-mac",
      deviceType: "desktop",
      browserName: "Chrome",
      browserVersion: "120",
      osName: "macOS",
      expiresAt: new Date(),
      createdAt: new Date("2024-01-01"),
      lastSeenAt: new Date("2024-01-02"),
      revokedAt: null,
      revokedReason: null,
    },
    {
      id: 2,
      userId: 123,
      refreshTokenHash: "hash-2",
      ipAddress: "192.168.1.2",
      userAgent: "Mozilla/5.0 (Macintosh)",
      deviceFingerprint: "fp-mac",
      deviceType: "desktop",
      browserName: "Chrome",
      browserVersion: "120",
      osName: "macOS",
      expiresAt: new Date(),
      createdAt: new Date("2024-01-03"),
      lastSeenAt: new Date("2024-01-04"),
      revokedAt: null,
      revokedReason: null,
    },
    {
      id: 3,
      userId: 123,
      refreshTokenHash: "hash-3",
      ipAddress: "192.168.1.3",
      userAgent: "Mozilla/5.0 (iPhone)",
      deviceFingerprint: "fp-phone",
      deviceType: "mobile",
      browserName: "Safari",
      browserVersion: "17",
      osName: "iOS",
      expiresAt: new Date(),
      createdAt: new Date("2024-01-05"),
      lastSeenAt: new Date("2024-01-06"),
      revokedAt: null,
      revokedReason: null,
    },
  ];

  beforeEach(() => {
    mockSessionRepository = createMockSessionRepository({
      findByUserId: mock(async () => sessions) as any,
      findById: mock(async (id: number) =>
        sessions.find((session) => session.id === id) ?? null
      ) as any,
    });

    useCase = new GetUserSessionsUseCase({
      sessionRepository: mockSessionRepository,
    });
  });

  it("should return sessions with device metadata and current flag", async () => {
    const result = await useCase.execute({
      userId: 123,
      currentSessionId: 1,
    });

    expect(result.sessions).toHaveLength(3);
    expect(result.sessions[0]).toMatchObject({
      id: 1,
      deviceType: "desktop",
      browserName: "Chrome",
      isCurrent: true,
    });
    expect(result.sessions[1]).toMatchObject({
      id: 2,
      isCurrent: true,
    });
    expect(result.sessions[2]).toMatchObject({
      id: 3,
      isCurrent: false,
    });
  });

  it("should mark session as current by id when current session record is missing", async () => {
    mockSessionRepository.findById = mock(async () => null);

    const result = await useCase.execute({
      userId: 123,
      currentSessionId: 3,
    });

    expect(result.sessions.find((s) => s.id === 3)?.isCurrent).toBe(true);
    expect(result.sessions.find((s) => s.id === 1)?.isCurrent).toBe(false);
  });
});
