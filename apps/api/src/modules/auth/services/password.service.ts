import argon2 from "argon2";

export class PasswordService {
  async hash(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,

      memoryCost: 19456,

      timeCost: 2,

      parallelism: 1,
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return await argon2.verify(hash, password);
  }
}
