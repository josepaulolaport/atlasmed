import argon2 from "argon2";

export class PasswordService {
  async hash(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return await argon2.verify(hash, password);
  }
}
