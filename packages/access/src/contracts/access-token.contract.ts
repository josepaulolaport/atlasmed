import type { JWTPayload } from "jose";
import type { Role } from "../enums/role.enum";

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  sid: string;
  role: Role;
  tokenVersion: number;
  iat: number;
}
