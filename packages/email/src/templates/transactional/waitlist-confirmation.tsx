import { Column, Heading, Row, Section, Text } from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";
import { ActionButton } from "../shared/action-button";
import { BaseLayout } from "../shared/base-layout";

interface WaitlistConfirmationEmailProps {
  githubHandle: string;
  memberNumber: number;
  referralCode: string;
}

export function WaitlistConfirmationEmail({
  githubHandle,
  memberNumber,
  referralCode,
}: WaitlistConfirmationEmailProps) {
  const encodedReferralCode = encodeURIComponent(referralCode);
  const ticketUrl = `${EMAIL_URLS.base}/waitlist?ref=${encodedReferralCode}&ticket=1`;
  const shareUrl = `${EMAIL_URLS.base}/r/${encodedReferralCode}`;

  return (
    <BaseLayout previewText="You're on the list! (Waitlist Ticket)">
      <Heading style={h1Style}>You&apos;re on the list.</Heading>

      <Text style={textStyle}>
        Hi @{githubHandle}, thanks for joining the stackmatch.dev queue. We are building the
        collaboration graph for the modern engineering ecosystem.
      </Text>

      <Section style={ticketContainerStyle}>
        <Row>
          <Column>
            <Text style={labelStyle}>Queue Position</Text>
            <Text style={rankStyle}>#{memberNumber.toString().padStart(4, "0")}</Text>
          </Column>
          <Column style={{ textAlign: "right" as const }}>
            <Text style={labelStyle}>Status</Text>
            <Text style={statusStyle}>Confirmed</Text>
          </Column>
        </Row>
      </Section>

      <Text style={textStyle}>
        Admission is processed in cohorts based on stack density and community invites. Want to move
        up? Share your unique invite link with your technical counterparts.
      </Text>

      <Section style={buttonContainerStyle}>
        <ActionButton href={ticketUrl}>View your Early Access Ticket</ActionButton>
      </Section>

      <Text style={subtextStyle}>
        Or copy your referral link:
        <br />
        <code style={codeStyle}>{shareUrl}</code>
      </Text>
    </BaseLayout>
  );
}

export default WaitlistConfirmationEmail;

const h1Style = {
  color: EMAIL_BRAND.text,
  fontSize: "24px",
  fontWeight: "800",
  margin: "0 0 16px",
  letterSpacing: "-0.03em",
  lineHeight: "32px",
};

const textStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 20px",
};

const ticketContainerStyle = {
  backgroundColor: EMAIL_BRAND.secondary,
  borderRadius: "12px",
  padding: "24px",
  marginBottom: "20px",
};

const labelStyle = {
  color: "rgba(255,255,255,0.45)",
  fontSize: "10px",
  fontWeight: "800",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  margin: "0 0 4px",
};

const rankStyle = {
  color: EMAIL_BRAND.white,
  fontSize: "40px",
  fontWeight: "800",
  margin: "0",
  lineHeight: "1",
  letterSpacing: "-0.02em",
};

const statusStyle = {
  color: "#34d399", // emerald-400 for better visibility on dark bg
  fontSize: "13px",
  fontWeight: "800",
  textTransform: "uppercase" as const,
  margin: "0",
};

const buttonContainerStyle = {
  margin: "24px 0",
};

const subtextStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 12px",
};

const codeStyle = {
  backgroundColor: EMAIL_BRAND.background,
  border: `1px solid ${EMAIL_BRAND.border}`,
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "12px",
  fontFamily: "monospace",
  display: "inline-block",
  marginTop: "8px",
};
