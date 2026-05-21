import { PasswordService } from "@/modules/access/services/password.service";
import { TokenService } from "@/modules/access/services/token.service";
import { AuthService } from "@/modules/access/services/auth.service";
export function createAccessModule() {
  const tokenService = new TokenService();

  const passwordService = new PasswordService();

  return new AuthService(tokenService, passwordService);
}
