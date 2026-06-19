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

interface InviteEmailProps {
  token: string;
  inviteUrl?: string | undefined;
  invitedByName?: string | undefined;
  roleName?: string | undefined;
}

export function InviteEmail({ token, inviteUrl, invitedByName, roleName }: InviteEmailProps) {
  const acceptLink = inviteUrl ? `${inviteUrl}?token=${token}` : undefined;

  return (
    <Html>
      <Head />
      <Preview>You've been invited to join AtlasMed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You're Invited!</Heading>

          <Text style={text}>
            {invitedByName ? `${invitedByName} has` : "You have been"} invited you to join
            AtlasMed
            {roleName ? ` as a ${roleName}` : ""}.
          </Text>

          <Text style={text}>Use the code below or click the link to accept your invitation.</Text>

          <Section style={codeContainer}>
            <Text style={code}>{token}</Text>
          </Section>

          {acceptLink && (
            <Section style={buttonContainer}>
              <Link href={acceptLink} style={button}>
                Accept Invitation
              </Link>
            </Section>
          )}

          <Text style={text}>
            This invitation will expire in 7 days. If you did not expect this invitation, please
            ignore this email.
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
