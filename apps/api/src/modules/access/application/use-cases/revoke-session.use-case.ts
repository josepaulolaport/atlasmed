import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { sessionsMatchSameDevice } from "../../../../shared/utils/device-fingerprint";
import type { IAuditLog } from "../interfaces/audit-log.interface";

interface RevokeSessionInput {
  sessionId: string;
  userId: string;
  currentSessionId: string;
}

type RevokeSessionOutput =
  | { success: true }
  | { success: false; error: "not-found" | "unauthorized" | "cannot-revoke-current" };

interface RevokeSessionDependencies {
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
  auditLog: IAuditLog;
}

export class RevokeSessionUseCase {
  constructor(private readonly dependencies: RevokeSessionDependencies) {}

  async execute(input: RevokeSessionInput): Promise<RevokeSessionOutput> {
    const session = await this.dependencies.sessionRepository.findById(input.sessionId);

    if (!session || session.revokedAt) {
      return { success: false, error: "not-found" };
    }

    if (session.userId !== input.userId) {
      return { success: false, error: "unauthorized" };
    }

    const currentSession = await this.dependencies.sessionRepository.findById(
      input.currentSessionId
    );

    if (
      currentSession &&
      sessionsMatchSameDevice(session, currentSession)
    ) {
      return { success: false, error: "cannot-revoke-current" };
    }

    const revokedSessionIds =
      await this.dependencies.sessionRepository.revokeAllActiveForDevice(
        session.userId,
        {
          id: session.id,
          deviceFingerprint: session.deviceFingerprint,
          userAgent: session.userAgent,
          deviceType: session.deviceType,
        },
        { reason: "Revoked by user" }
      );

    if (revokedSessionIds.length === 0) {
      return { success: false, error: "not-found" };
    }

    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.dependencies.sessionCache.invalidate(sessionId)
      )
    );

    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.dependencies.auditLog.logSessionRevoke({
          userId: input.userId,
          sessionId,
          reason: "Revoked by user",
          revokedByUserId: input.userId,
        })
      )
    );

    return { success: true };
  }
}
