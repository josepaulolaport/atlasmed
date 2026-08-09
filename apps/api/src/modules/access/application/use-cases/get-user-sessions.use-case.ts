import type { SessionRepository } from "../interfaces/session.repository.interface";
import { sessionsMatchSameDevice } from "../../../../shared/utils/device-fingerprint";

interface GetUserSessionsInput {
  userId: number;
  currentSessionId: number;
}

interface SessionOutput {
  id: number;
  deviceType: string | null;
  browserName: string | null;
  browserVersion: string | null;
  osName: string | null;
  ipAddress: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  isCurrent: boolean;
}

interface GetUserSessionsOutput {
  sessions: SessionOutput[];
}

interface GetUserSessionsDependencies {
  sessionRepository: SessionRepository;
}

export class GetUserSessionsUseCase {
  constructor(private readonly dependencies: GetUserSessionsDependencies) {}

  async execute(input: GetUserSessionsInput): Promise<GetUserSessionsOutput> {
    const [sessions, currentSession] = await Promise.all([
      this.dependencies.sessionRepository.findByUserId(input.userId),
      this.dependencies.sessionRepository.findById(input.currentSessionId),
    ]);

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        deviceType: session.deviceType,
        browserName: session.browserName,
        browserVersion: session.browserVersion,
        osName: session.osName,
        ipAddress: session.ipAddress,
        lastSeenAt: session.lastSeenAt,
        createdAt: session.createdAt,
        isCurrent: currentSession
          ? sessionsMatchSameDevice(session, currentSession)
          : session.id === input.currentSessionId,
      })),
    };
  }
}
