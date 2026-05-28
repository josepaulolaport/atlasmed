import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type Redis from "ioredis";
import { generateSecret, generateURI, verify } from "otplib";
import { environment } from "../../../../app/config/environment";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PENDING_SETUP_TTL_SECONDS = 10 * 60;

interface Dependencies {
  redis: Redis;
}

export class TwoFactorService {
  constructor(private readonly deps: Dependencies) {}

  generateSecret(): string {
    return generateSecret();
  }

  generateOtpAuthUrl(params: { email: string; secret: string }): string {
    return generateURI({
      issuer: "AtlasMed",
      label: params.email,
      secret: params.secret,
    });
  }

  async verifyTotp(token: string, secret: string): Promise<boolean> {
    const result = await verify({ token, secret });
    return result.valid;
  }

  encryptSecret(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
  }

  decryptSecret(ciphertext: string): string {
    const key = this.getEncryptionKey();
    const data = Buffer.from(ciphertext, "base64");
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  }

  private getEncryptionKey(): Buffer {
    const hex = environment.TWO_FACTOR_ENCRYPTION_KEY;
    if (!hex) {
      throw new Error("TWO_FACTOR_ENCRYPTION_KEY is not configured");
    }
    return Buffer.from(hex, "hex");
  }

  private getPendingSetupKey(userId: string): string {
    return `${environment.REDIS_KEY_PREFIX}pending_2fa_setup:${userId}`;
  }

  async storePendingSetup(userId: string, secret: string): Promise<void> {
    await this.deps.redis.setex(
      this.getPendingSetupKey(userId),
      PENDING_SETUP_TTL_SECONDS,
      secret
    );
  }

  async getPendingSetup(userId: string): Promise<string | null> {
    return await this.deps.redis.get(this.getPendingSetupKey(userId));
  }

  async clearPendingSetup(userId: string): Promise<void> {
    await this.deps.redis.del(this.getPendingSetupKey(userId));
  }
}
