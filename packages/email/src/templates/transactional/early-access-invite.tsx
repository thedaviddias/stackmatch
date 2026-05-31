import { Heading, Section, Text } from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";
import { ActionButton } from "../shared/action-button";
import { BaseLayout } from "../shared/base-layout";

interface EarlyAccessInviteEmailProps {
  githubHandle: string;
  inviteToken: string;
  referralCode?: string;
}

export function EarlyAccessInviteEmail({
  githubHandle,
  inviteToken,
  referralCode,
}: EarlyAccessInviteEmailProps) {
  const inviteUrl = new URL(`/invite/${inviteToken}`, EMAIL_URLS.base);
  if (referralCode) {
    inviteUrl.searchParams.set("ref", referralCode);
  }

  return (
    <BaseLayout previewText="You're invited! Access stackmatch.dev now.">
      <Heading style={h1Style}>You&apos;re in.</Heading>

      <Text style={textStyle}>
        Hi @{githubHandle}, your cohort is ready. You now have early access to the stackmatch.dev
        platform.
      </Text>

      <Text style={textStyle}>
        Stackmatch is where your technical DNA becomes your network. Start matching with peers,
        getting code reviews, and finding your next building partners.
      </Text>

      <Section style={buttonContainerStyle}>
        <ActionButton href={inviteUrl.toString()}>Claim your Early Access</ActionButton>
      </Section>

      <Section style={infoBoxStyle}>
        <Text style={infoTitleStyle}>What to do first:</Text>
        <Text style={infoTextStyle}>
          1. <strong>Sync your stack:</strong> We&apos;ll index your public and private
          contributions.
          <br />
          2. <strong>Get Matched:</strong> See who matches your specific package versions.
          <br />
          3. <strong>Collaborate:</strong> Join the Review Exchange to unblock your PRs.
        </Text>
      </Section>

      <Text style={subtextStyle}>This invite link is unique to you and will expire in 7 days.</Text>
    </BaseLayout>
  );
}

export default EarlyAccessInviteEmail;

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

const buttonContainerStyle = {
  margin: "24px 0 32px",
};

const infoBoxStyle = {
  backgroundColor: EMAIL_BRAND.background,
  borderRadius: "8px",
  padding: "20px",
  border: `1px solid ${EMAIL_BRAND.border}`,
  marginBottom: "24px",
};

const infoTitleStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "13px",
  fontWeight: "800",
  margin: "0 0 10px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const infoTextStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
};

const subtextStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  textAlign: "center" as const,
};
