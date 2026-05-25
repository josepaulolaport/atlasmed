import { InvalidCredentialsError } from "@atlasmed/access";

import type { UserRepository } from "../interfaces/user.repository.interface";

import type { SessionRepository } from "../interfaces/session.repository.interface";

import type { ISessionCache } from "../interfaces/session-cache.interface";

import { PasswordService } from "../services/password.service";

import { SessionService } from "../services/session.service";

import { TokenService } from "../services/token.service";

import { RateLimiterService } from "../services/rate-limiter.service";

import type Redis from "ioredis";

interface Dependencies {
  userRepository: UserRepository;

  sessionRepository: SessionRepository;

  sessionCache: ISessionCache;

  redis: Redis;
}

interface LoginParams {
  identifier: string;
  password: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class LoginUseCase {
  private readonly passwordService = new PasswordService();

  private readonly tokenService = new TokenService();

  private readonly sessionService: SessionService;

  private readonly rateLimiterService: RateLimiterService;

  constructor(private readonly deps: Dependencies) {
    this.sessionService = new SessionService({
      sessionRepository: deps.sessionRepository,
      sessionCache: deps.sessionCache,
    });
    this.rateLimiterService = new RateLimiterService({
      redis: deps.redis,
    });
  }

  async execute(params: LoginParams) {
    // Check rate limiting before attempting login
    await this.rateLimiterService.checkLoginAttempts(params.identifier);

    const user = await this.deps.userRepository.findByIdentifier({
      identifier: params.identifier,
    });

    if (!user) {
      // Record failed attempt
      await this.rateLimiterService.recordFailedAttempt(params.identifier);
      throw new InvalidCredentialsError();
    }

    const validPassword = await this.passwordService.verify(
      params.password,
      user.passwordHash,
    );

    if (!validPassword) {
      // Record failed attempt
      await this.rateLimiterService.recordFailedAttempt(params.identifier);
      throw new InvalidCredentialsError();
    }

    // Clear rate limiting on successful login
    await this.rateLimiterService.clearAttempts(params.identifier);

    await this.deps.userRepository.updateLastLogin(user.id);

    const session = await this.sessionService.create({
      userId: user.id,

      userRole: user.role.name,

      ipAddress: params.ipAddress || undefined,

      userAgent: params.userAgent || undefined,
    });

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,

      sid: session.id,

      role: user.role.name,

      tokenVersion: user.tokenVersion,

      iat: Math.floor(Date.now() / 1000),
    });

    return {
      accessToken,

      refreshToken: session.refreshToken,

      user,
    };
  }
}
