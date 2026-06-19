import { Elysia, t } from "elysia";
import { accessServices, auth } from "../../composition";
import { verificationRateLimit } from "../middleware/rate-limit.middleware";

export const verificationRoute = new Elysia({ 
  prefix: "/verification",
  detail: {
    tags: ["Users"],
  },
})
  .use(auth)
  .use(verificationRateLimit)
  .post("/email/request", async ({ getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.requestEmailVerification({
      userId,
    });

    return {
      message: "Verification email sent successfully",
    };
  }, {
    detail: {
      summary: "Request email verification",
      description: "Send a verification email to the user's email address",
      tags: ["Users"],
    },
  })
  .post("/email/verify", async ({ body, getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.verifyEmail({
      userId,
      token: body.token,
    });

    return {
      message: "Email verified successfully",
    };
  }, {
    detail: {
      summary: "Verify email",
      description: "Verify email address using the token sent via email",
      tags: ["Users"],
    },
    body: t.Object({
      token: t.String({ description: "Verification token" }),
    }),
  })
  .post("/phone/request", async ({ getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.requestPhoneVerification({
      userId,
    });

    return {
      message: "Verification code sent successfully",
    };
  }, {
    detail: {
      summary: "Request phone verification",
      description: "Send a verification code to the user's phone number",
      tags: ["Users"],
    },
  })
  .post("/phone/verify", async ({ body, getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.verifyPhone({
      userId,
      token: body.token,
    });

    return {
      message: "Phone verified successfully",
    };
  }, {
    detail: {
      summary: "Verify phone",
      description: "Verify phone number using the code sent via SMS",
      tags: ["Users"],
    },
    body: t.Object({
      token: t.String({ description: "Verification code" }),
    }),
  })
  .post("/email/change", async ({ body, getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.requestEmailChange({
      userId,
      newEmail: body.newEmail,
    });

    return {
      message: "Verification email sent to new address",
    };
  }, {
    detail: {
      summary: "Request email change",
      description: "Request to change email address. A verification link will be sent to the new email.",
      tags: ["Users"],
    },
    body: t.Object({
      newEmail: t.String({ format: "email", description: "New email address" }),
    }),
  })
  .post("/email/change/confirm", async ({ body, getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.changeEmail({
      userId,
      newEmail: body.newEmail,
      token: body.token,
    });

    return {
      message: "Email changed successfully",
    };
  }, {
    detail: {
      summary: "Confirm email change",
      description: "Confirm email change using the verification token",
      tags: ["Users"],
    },
    body: t.Object({
      newEmail: t.String({ format: "email", description: "New email address" }),
      token: t.String({ description: "Verification token" }),
    }),
  })
  .post("/phone/change", async ({ body, getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.requestPhoneChange({
      userId,
      newPhone: body.newPhone,
    });

    return {
      message: "Verification code sent to new phone number",
    };
  }, {
    detail: {
      summary: "Request phone change",
      description: "Request to change phone number. A verification code will be sent to the new number.",
      tags: ["Users"],
    },
    body: t.Object({
      newPhone: t.String({ description: "New phone number" }),
    }),
  })
  .post("/phone/change/confirm", async ({ body, getUserId }: any) => {
    const userId = await getUserId();
    
    await accessServices.verification.changePhone({
      userId,
      newPhone: body.newPhone,
      token: body.token,
    });

    return {
      message: "Phone number changed successfully",
    };
  }, {
    detail: {
      summary: "Confirm phone change",
      description: "Confirm phone number change using the verification code",
      tags: ["Users"],
    },
    body: t.Object({
      newPhone: t.String({ description: "New phone number" }),
      token: t.String({ description: "Verification code" }),
    }),
  });
