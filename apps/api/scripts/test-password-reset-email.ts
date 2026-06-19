#!/usr/bin/env bun
import "dotenv/config";
import { apiEnv } from "@atlasmed/config";
import { resend } from "../src/infrastructure/external-services/resend/resend.client";
import { createElement } from "react";
import { PasswordResetEmail } from "../src/infrastructure/external-services/resend/templates/password-reset.email";

const to = process.argv[2] ?? "jlaport592@gmail.com";

async function main() {
  console.log("\n📧 Password reset email test\n");
  console.log("RESEND_API_KEY:", apiEnv.RESEND_API_KEY ? "set" : "missing");
  console.log("RESEND_FROM_EMAIL:", apiEnv.RESEND_FROM_EMAIL ?? "missing");

  if (!resend || !apiEnv.RESEND_API_KEY || !apiEnv.RESEND_FROM_EMAIL) {
    console.error("\n❌ Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in apps/api/.env");
    process.exit(1);
  }

  if (apiEnv.RESEND_API_KEY.includes("xxxxxxxx")) {
    console.error("\n❌ RESEND_API_KEY is still a placeholder. Add your real Resend API key.");
    process.exit(1);
  }

  const token = "TEST-RESET-TOKEN";
  const result = await resend.emails.send({
    from: apiEnv.RESEND_FROM_EMAIL,
    to,
    subject: "AtlasMed Password Reset Test",
    react: createElement(PasswordResetEmail, {
      token,
      resetUrl: process.env.FRONTEND_URL,
    }),
  });

  console.log("\n✅ Email sent:", result);
}

main().catch((error) => {
  console.error("\n❌ Failed to send:", error);
  process.exit(1);
});
