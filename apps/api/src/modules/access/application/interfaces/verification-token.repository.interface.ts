import type { VerificationTokenType } from "@atlasmed/database";

export interface CreateVerificationTokenParams {
  userId: number;
  type: VerificationTokenType;
  tokenHash: string;
  newValue?: string;
  expiresAt: Date;
}

export interface FindValidVerificationTokenParams {
  tokenHash: string;
  userId: number;
  type: VerificationTokenType;
}

export interface VerificationTokenRecord {
  id: number;
  newValue: string | null;
}

export interface VerificationTokenRepository {
  deleteUnusedByUserAndType(userId: number, type: VerificationTokenType): Promise<void>;

  create(params: CreateVerificationTokenParams): Promise<void>;

  findValidToken(params: FindValidVerificationTokenParams): Promise<VerificationTokenRecord | null>;

  markVerified(id: number): Promise<void>;
}
