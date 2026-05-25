import { beforeEach, describe, expect, it } from "bun:test";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  let passwordService: PasswordService;

  beforeEach(() => {
    passwordService = new PasswordService();
  });

  describe("hash", () => {
    it("should hash a password", async () => {
      const password = "secure-password-123";

      const hash = await passwordService.hash(password);

      expect(hash).toBeString();
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).not.toBe(password);
    });

    it("should produce different hashes for the same password", async () => {
      const password = "secure-password-123";

      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);

      expect(hash1).not.toBe(hash2);
    });

    it("should produce hashes starting with $argon2id", async () => {
      const password = "secure-password-123";

      const hash = await passwordService.hash(password);

      expect(hash).toStartWith("$argon2id");
    });

    it("should hash empty string", async () => {
      const password = "";

      const hash = await passwordService.hash(password);

      expect(hash).toBeString();
      expect(hash).toStartWith("$argon2id");
    });

    it("should hash very long password", async () => {
      const password = "a".repeat(1000);

      const hash = await passwordService.hash(password);

      expect(hash).toBeString();
      expect(hash).toStartWith("$argon2id");
    });

    it("should hash password with special characters", async () => {
      const password = "p@$$w0rd!#%&*()[]{}";

      const hash = await passwordService.hash(password);

      expect(hash).toBeString();
      expect(hash).toStartWith("$argon2id");
    });
  });

  describe("verify", () => {
    it("should return true for correct password", async () => {
      const password = "secure-password-123";
      const hash = await passwordService.hash(password);

      const result = await passwordService.verify(password, hash);

      expect(result).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const password = "secure-password-123";
      const wrongPassword = "wrong-password";
      const hash = await passwordService.hash(password);

      const result = await passwordService.verify(wrongPassword, hash);

      expect(result).toBe(false);
    });

    it("should return false for slightly different password", async () => {
      const password = "secure-password-123";
      const almostRight = "secure-password-124";
      const hash = await passwordService.hash(password);

      const result = await passwordService.verify(almostRight, hash);

      expect(result).toBe(false);
    });

    it("should return false for empty password when hash is not for empty string", async () => {
      const password = "secure-password-123";
      const hash = await passwordService.hash(password);

      const result = await passwordService.verify("", hash);

      expect(result).toBe(false);
    });

    it("should return true for empty password when hash is for empty string", async () => {
      const password = "";
      const hash = await passwordService.hash(password);

      const result = await passwordService.verify("", hash);

      expect(result).toBe(true);
    });

    it("should be case-sensitive", async () => {
      const password = "Password123";
      const hash = await passwordService.hash(password);

      const resultLower = await passwordService.verify("password123", hash);
      const resultUpper = await passwordService.verify("PASSWORD123", hash);

      expect(resultLower).toBe(false);
      expect(resultUpper).toBe(false);
    });

    it("should verify password with special characters", async () => {
      const password = "p@$$w0rd!#%&*()[]{}";
      const hash = await passwordService.hash(password);

      const result = await passwordService.verify(password, hash);

      expect(result).toBe(true);
    });

    it("should reject invalid hash format", async () => {
      const password = "secure-password-123";
      const invalidHash = "not-a-valid-hash";

      await expect(passwordService.verify(password, invalidHash)).rejects.toThrow();
    });
  });

  describe("hash security properties", () => {
    it("should produce deterministically verifiable but non-deterministic hashes", async () => {
      const password = "test-password";

      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);

      expect(hash1).not.toBe(hash2);

      const verify1 = await passwordService.verify(password, hash1);
      const verify2 = await passwordService.verify(password, hash2);

      expect(verify1).toBe(true);
      expect(verify2).toBe(true);
    });
  });
});
