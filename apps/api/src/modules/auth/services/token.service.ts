import { randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { apiEnv } from "@atlasmed/config";

import type { AccessTokenPayload } from "@atlasmed/access";

const secret = new TextEncoder().encode(apiEnv.JWT_SECRET);

export class TokenService {
  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return await new SignJWT(payload)

      .setProtectedHeader({
        alg: "HS256",
      })

      .setSubject(payload.sub)

      .setExpirationTime("15m")

      .sign(secret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const verified = await jwtVerify(token, secret);

    return verified.payload as AccessTokenPayload;
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }
}
