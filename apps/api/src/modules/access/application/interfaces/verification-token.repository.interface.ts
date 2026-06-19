import type { VerificationTokenType } from "@atlasmed/database";

export interface CreateVerificationTokenParams {
  userId: string;
  type: VerificationTokenType;
  tokenHash: string;
  newValue?: string;
  expiresAt: Date;
}

export interface FindValidVerificationTokenParams {
  tokenHash: string;
  userId: string;
  type: VerificationTokenType;
}

export interface VerificationTokenRecord {
  id: string;
  newValue: string | null;
}

export interface VerificationTokenRepository {
  deleteUnusedByUserAndType(userId: string, type: VerificationTokenType): Promise<void>;

  create(params: CreateVerificationTokenParams): Promise<void>;

  findValidToken(params: FindValidVerificationTokenParams): Promise<VerificationTokenRecord | null>;

  markVerified(id: string): Promise<void>;
}
