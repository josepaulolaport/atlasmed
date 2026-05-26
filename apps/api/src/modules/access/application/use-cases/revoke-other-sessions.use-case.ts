import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";

interface RevokeOtherSessionsInput {
  userId: string;
  currentSessionId: string;
}

interface RevokeOtherSessionsDependencies {
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
}

export class RevokeOtherSessionsUseCase {
  constructor(private readonly dependencies: RevokeOtherSessionsDependencies) {}

  async execute(input: RevokeOtherSessionsInput): Promise<{ revokedCount: number }> {
    const currentSession = await this.dependencies.sessionRepository.findById(
      input.currentSessionId
    );

    if (!currentSession || currentSession.userId !== input.userId) {
      return { revokedCount: 0 };
    }

    const revokedSessionIds =
      await this.dependencies.sessionRepository.revokeAllExceptDevice(
        input.userId,
        {
          id: currentSession.id,
          deviceFingerprint: currentSession.deviceFingerprint,
          userAgent: currentSession.userAgent,
          deviceType: currentSession.deviceType,
        },
        { reason: "Logout from other devices" }
      );

    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.dependencies.sessionCache.invalidate(sessionId)
      )
    );

    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        auditLogService.logSessionRevoke({
          userId: input.userId,
          sessionId,
          reason: "Logout from other devices",
          revokedByUserId: input.userId,
        })
      )
    );

    return { revokedCount: revokedSessionIds.length };
  }
}
