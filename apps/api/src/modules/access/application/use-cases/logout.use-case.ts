import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { IAuditLog } from "../interfaces/audit-log.interface";

interface Dependencies {
  sessionRepository: SessionRepository;
  sessionCache: ISessionCache;
  authCache: IAuthCache;
  auditLog: IAuditLog;
}

export class LogoutUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { sessionId: string; userId: string; ipAddress?: string }) {
    await this.deps.sessionRepository.revoke(params.sessionId);
    await this.deps.sessionCache.invalidate(params.sessionId);
    await this.deps.authCache.invalidate(params.userId);

    await this.deps.auditLog.logUserLogout({
      userId: params.userId,
      sessionId: params.sessionId,
      ipAddress: params.ipAddress,
    });
  }
}
