import { beforeEach, describe, expect, it } from "bun:test";
import { jwtVerify } from "jose";
import { TokenService } from "./token.service";
import type { AccessTokenPayload } from "@atlasmed/access";

describe("TokenService", () => {
  let tokenService: TokenService;

  beforeEach(() => {
    tokenService = new TokenService();
  });

  describe("signAccessToken", () => {
    it("should sign a valid JWT with correct payload", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);

      expect(token).toBeString();
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include sub in JWT payload", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);
      const verified = await tokenService.verifyAccessToken(token);

      expect(verified.sub).toBe("user-123");
    });

    it("should include sid in JWT payload", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);
      const verified = await tokenService.verifyAccessToken(token);

      expect(verified.sid).toBe("session-456");
    });

    it("should set expiration time to 15 minutes", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);
      const verified = await tokenService.verifyAccessToken(token);

      expect(verified.exp).toBeDefined();
      const expiresIn = verified.exp! - Math.floor(Date.now() / 1000);
      expect(expiresIn).toBeGreaterThan(14 * 60);
      expect(expiresIn).toBeLessThanOrEqual(15 * 60);
    });

    it("should use HS256 algorithm", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);
      const parts = token.split(".");
      const header = JSON.parse(atob(parts[0]!));

      expect(header.alg).toBe("HS256");
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid JWT", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);
      const verified = await tokenService.verifyAccessToken(token);

      expect(verified.sub).toBe("user-123");
      expect(verified.sid).toBe("session-456");
    });

    it("should reject invalid JWT", async () => {
      const invalidToken = "invalid.jwt.token";

      await expect(tokenService.verifyAccessToken(invalidToken)).rejects.toThrow();
    });

    it("should reject malformed JWT", async () => {
      const malformedToken = "not-a-jwt";

      await expect(tokenService.verifyAccessToken(malformedToken)).rejects.toThrow();
    });

    it("should reject JWT with tampered payload", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);
      const parts = token.split(".");
      
      const tamperedPayload = btoa(JSON.stringify({ sub: "hacker-999", sid: "session-456" }));
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      await expect(tokenService.verifyAccessToken(tamperedToken)).rejects.toThrow();
    });

    it("should return payload with correct type", async () => {
      const payload: AccessTokenPayload = {
        sub: "user-123",
        sid: "session-456",
        role: "USER",
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await tokenService.signAccessToken(payload);
      const verified = await tokenService.verifyAccessToken(token);

      expect(verified).toHaveProperty("sub");
      expect(verified).toHaveProperty("sid");
      expect(verified).toHaveProperty("exp");
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a token", () => {
      const token = tokenService.generateRefreshToken();

      expect(token).toBeString();
      expect(token.length).toBeGreaterThan(0);
    });

    it("should generate unique tokens", () => {
      const token1 = tokenService.generateRefreshToken();
      const token2 = tokenService.generateRefreshToken();

      expect(token1).not.toBe(token2);
    });

    it("should generate base64url encoded tokens", () => {
      const token = tokenService.generateRefreshToken();

      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate tokens of consistent length", () => {
      const token1 = tokenService.generateRefreshToken();
      const token2 = tokenService.generateRefreshToken();

      expect(token1.length).toBe(token2.length);
    });
  });
});
