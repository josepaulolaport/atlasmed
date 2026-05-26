#!/usr/bin/env bun

// Test script to verify email and SMS configuration
import { apiEnv } from "@atlasmed/config";
import { resend } from "./src/infrastructure/external-services/resend/resend.client";
import { twilioClient } from "./src/infrastructure/external-services/twilio/twilio.client";

console.log("\n🔍 Checking Email & SMS Configuration\n");
console.log("=" .repeat(50));

// Check Resend (Email)
console.log("\n📧 Resend (Email) Configuration:");
console.log("   RESEND_API_KEY:", apiEnv.RESEND_API_KEY ? `✅ SET (${apiEnv.RESEND_API_KEY.substring(0, 10)}...)` : "❌ NOT SET");
console.log("   RESEND_FROM_EMAIL:", apiEnv.RESEND_FROM_EMAIL || "❌ NOT SET");
console.log("   Resend Client:", resend ? "✅ Initialized" : "❌ Not initialized");

// Check Twilio (WhatsApp)
console.log("\n📱 Twilio (WhatsApp) Configuration:");
console.log("   TWILIO_ACCOUNT_SID:", apiEnv.TWILIO_ACCOUNT_SID ? `✅ SET (${apiEnv.TWILIO_ACCOUNT_SID.substring(0, 10)}...)` : "❌ NOT SET");
console.log("   TWILIO_AUTH_TOKEN:", apiEnv.TWILIO_AUTH_TOKEN ? "✅ SET (hidden)" : "❌ NOT SET");
console.log("   TWILIO_WHATSAPP_FROM:", apiEnv.TWILIO_WHATSAPP_FROM || "❌ NOT SET");
console.log("   Twilio Client:", twilioClient ? "✅ Initialized" : "❌ Not initialized");

console.log("\n" + "=".repeat(50));

// Test Resend API key format
if (apiEnv.RESEND_API_KEY) {
  if (!apiEnv.RESEND_API_KEY.startsWith("re_")) {
    console.log("\n⚠️  WARNING: Resend API key should start with 're_'");
  }
}

// Test Twilio SID format
if (apiEnv.TWILIO_ACCOUNT_SID) {
  if (!apiEnv.TWILIO_ACCOUNT_SID.startsWith("AC")) {
    console.log("\n⚠️  WARNING: Twilio Account SID should start with 'AC'");
  }
}

// Test Twilio WhatsApp number format
if (apiEnv.TWILIO_WHATSAPP_FROM) {
  if (!apiEnv.TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")) {
    console.log("\n⚠️  WARNING: Twilio WhatsApp FROM should start with 'whatsapp:'");
  }
}

console.log("\n✨ Configuration check complete!\n");

// Optional: Test sending (commented out by default)
/*
if (resend && process.argv.includes("--test-email")) {
  const testEmail = process.argv[process.argv.indexOf("--test-email") + 1];
  console.log(`\n🧪 Testing email send to ${testEmail}...`);
  
  try {
    const result = await resend.emails.send({
      from: apiEnv.RESEND_FROM_EMAIL!,
      to: testEmail,
      subject: "Test Email from AtlasMed",
      html: "<h1>Test</h1><p>If you receive this, email sending is working!</p>",
    });
    console.log("✅ Test email sent successfully!", result);
  } catch (error) {
    console.error("❌ Test email failed:", error);
  }
}
*/
