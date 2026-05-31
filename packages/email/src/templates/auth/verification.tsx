import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BRAND } from "../../keys";
import type { VerificationEmailProps } from "../../types";
import { BaseLayout } from "../shared/base-layout";

export function VerificationEmail({
  name,
  verificationLink,
  expiresIn = 60,
}: VerificationEmailProps) {
  return (
    <BaseLayout previewText="Verify your email address">
      <Section style={contentStyle}>
        <Text style={headingStyle}>Verify Your Email</Text>
        <Text style={paragraphStyle}>Hi {name},</Text>
        <Text style={paragraphStyle}>
          Click the button below to verify your email address. This link will expire in {expiresIn}{" "}
          minutes.
        </Text>
        <Button href={verificationLink} style={buttonStyle}>
          Verify Email
        </Button>
        <Text style={disclaimerStyle}>
          If you didn&apos;t create a StackMatch account, you can safely ignore this email.
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default VerificationEmail;

const contentStyle = {
  padding: "0 30px",
};

const headingStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "24px",
  fontWeight: "700" as const,
  lineHeight: "32px",
  margin: "0 0 16px",
};

const paragraphStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const buttonStyle = {
  backgroundColor: EMAIL_BRAND.primary,
  borderRadius: "8px",
  color: EMAIL_BRAND.white,
  display: "inline-block" as const,
  fontSize: "16px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  textDecoration: "none",
};

const disclaimerStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "14px",
  lineHeight: "20px",
  marginTop: "24px",
};
