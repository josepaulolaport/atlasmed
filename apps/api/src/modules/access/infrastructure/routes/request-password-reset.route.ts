import { Elysia, t } from "elysia";

import { PrismaUserRepository } from "../repositories/prisma/prisma-user.repository";
import { PrismaPasswordResetRepository } from "../repositories/prisma/prisma-password-reset.repository";
import { prisma } from "../../../../infrastructure/database/prisma.client";

import { RequestPasswordResetUseCase } from "../../application/use-cases/request-password-reset.use-case";
import { ResendEmailService } from "../../../../infrastructure/external-services/resend/resend-email.service";
import { TwilioMessagingService } from "../../../../infrastructure/external-services/twilio/twilio-messaging.service";

const userRepository = new PrismaUserRepository();
const passwordResetRepository = new PrismaPasswordResetRepository({ prisma });
const emailService = new ResendEmailService();
const messagingService = new TwilioMessagingService();

const requestPasswordResetUseCase = new RequestPasswordResetUseCase({
  userRepository,
  passwordResetRepository,
  emailService,
  messagingService,
});

export const requestPasswordResetRoute = new Elysia({
  prefix: "/access",
  detail: {
    tags: ["Authentication"],
  },
}).post(
  "/password-reset/request",

  async ({ body }) => {
    await requestPasswordResetUseCase.execute({
      identifier: body.identifier,
    });

    return {
      message:
        "If an account exists with this identifier, a password reset code has been sent.",
    };
  },
  {
    detail: {
      summary: "Request password reset",
      description:
        "Request a password reset code. Code will be sent via email or WhatsApp depending on the user's contact information.",
      tags: ["Authentication"],
    },
    body: t.Object({
      identifier: t.String({
        description: "Email or phone number",
      }),
    }),
    response: {
      200: t.Object({
        message: t.String(),
      }),
      400: t.Object({
        error: t.String({ description: "Validation error" }),
      }),
    },
  }
);
