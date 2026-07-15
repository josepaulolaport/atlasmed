import { randomBytes } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import type { AccessTokenPayload } from "@atlasmed/access";

import { environment } from "../../../../app/config/environment";

const secret = new TextEncoder().encode(environment.JWT_ACCESS_SECRET);

export class TokenService {
  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return await new SignJWT({
      sub: payload.sub,
      sid: payload.sid,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
      iat: Math.floor(Date.now() / 1000),
    })

      .setProtectedHeader({
        alg: "HS256",
      })

      .setSubject(payload.sub)

      .setIssuer(environment.JWT_ISSUER)

      .setAudience(environment.JWT_AUDIENCE)

      .setExpirationTime(environment.JWT_EXPIRATION)

      .sign(secret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const verified = await jwtVerify(token, secret, {
      issuer: environment.JWT_ISSUER,
      audience: environment.JWT_AUDIENCE,
    });

    return verified.payload as AccessTokenPayload;
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString("base64url");
  }
}
