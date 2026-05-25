import type { SessionRepository } from "../interfaces/session.repository.interface";

interface Dependencies {
  sessionRepository: SessionRepository;
}

export class LogoutUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { sessionId: string }) {
    await this.deps.sessionRepository.revoke(params.sessionId);
  }
}
