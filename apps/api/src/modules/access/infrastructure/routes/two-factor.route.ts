import { Elysia, t } from "elysia";
import { environment } from "../../../../app/config/environment";
import { accessUseCases, auth } from "../../composition";
import { twoFactorRateLimit } from "../middleware/rate-limit.middleware";
import { getClientIp } from "../../../../shared/utils/client-ip";

function requireTwoFactorEnabled() {
  return new Elysia({ name: "require-two-factor-enabled" }).onBeforeHandle(
    ({ set }) => {
      if (!environment.TWO_FACTOR_ENABLED) {
        set.status = 501;
        return { error: "Two-factor authentication is not enabled" };
      }
    }
  );
}

export const twoFactorRoute = new Elysia({
  detail: {
    tags: ["Authentication"],
  },
})
  .use(twoFactorRateLimit)
  .use(requireTwoFactorEnabled())
  .use(auth)
  .post(
    "/2fa/setup",
    async ({ getUserId }: any) => {
      const userId = await getUserId();
      return await accessUseCases.setup2fa().execute({ userId });
    },
    {
      detail: {
        summary: "Start 2FA setup",
        description:
          "Generate a TOTP secret and otpauth URI for authenticator app enrollment.",
        tags: ["Authentication"],
      },
      response: {
        200: t.Object({
          secret: t.String(),
          otpauthUrl: t.String(),
        }),
        501: t.Object({
          error: t.String(),
        }),
      },
    }
  )
  .post(
    "/2fa/confirm",
    async ({ getUserId, body, request }: any) => {
      const userId = await getUserId();
      return await accessUseCases.confirm2faSetup().execute({
        userId,
        code: body.code,
        ipAddress: getClientIp(request),
      });
    },
    {
      detail: {
        summary: "Confirm 2FA setup",
        description: "Verify a TOTP code and enable two-factor authentication.",
        tags: ["Authentication"],
      },
      body: t.Object({
        code: t.String({ description: "6-digit TOTP code", minLength: 6, maxLength: 6 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
        501: t.Object({
          error: t.String(),
        }),
      },
    }
  )
  .post(
    "/2fa/disable",
    async ({ getUserId, body, request }: any) => {
      const userId = await getUserId();
      return await accessUseCases.disable2fa().execute({
        userId,
        password: body.password,
        code: body.code,
        ipAddress: getClientIp(request),
      });
    },
    {
      detail: {
        summary: "Disable 2FA",
        description:
          "Disable two-factor authentication after verifying password and TOTP code.",
        tags: ["Authentication"],
      },
      body: t.Object({
        password: t.String({ description: "Account password", minLength: 8 }),
        code: t.String({ description: "6-digit TOTP code", minLength: 6, maxLength: 6 }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
        501: t.Object({
          error: t.String(),
        }),
      },
    }
  );
