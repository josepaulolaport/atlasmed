import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PasswordResetEmailProps {
  token: string;
  resetUrl?: string | undefined;
}

export function PasswordResetEmail({ token, resetUrl }: PasswordResetEmailProps) {
  const resetLink = resetUrl ? `${resetUrl}?token=${token}` : undefined;

  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Password Reset Request</Heading>

          <Text style={text}>
            You recently requested to reset your password. Use the code below or click the link to
            reset your password.
          </Text>

          <Section style={codeContainer}>
            <Text style={code}>{token}</Text>
          </Section>

          {resetLink && (
            <Section style={buttonContainer}>
              <Link href={resetLink} style={button}>
                Reset Password
              </Link>
            </Section>
          )}

          <Text style={text}>
            This password reset code will expire in 1 hour. If you did not request a password
            reset, please ignore this email.
          </Text>

          <Text style={footer}>AtlasMed - Healthcare Management System</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
  textAlign: "center" as const,
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  textAlign: "center" as const,
  margin: "16px 0",
  padding: "0 40px",
};

const codeContainer = {
  background: "#f4f4f4",
  borderRadius: "4px",
  margin: "16px auto 16px",
  width: "280px",
};

const code = {
  color: "#000",
  display: "inline-block",
  fontSize: "32px",
  fontWeight: 700,
  letterSpacing: "6px",
  lineHeight: "40px",
  paddingBottom: "8px",
  paddingTop: "8px",
  margin: "0 auto",
  width: "100%",
  textAlign: "center" as const,
};

const buttonContainer = {
  margin: "27px auto",
  width: "auto",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#007bff",
  borderRadius: "3px",
  fontWeight: "600",
  color: "#fff",
  fontSize: "15px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "11px 23px",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  textAlign: "center" as const,
  marginTop: "32px",
};
