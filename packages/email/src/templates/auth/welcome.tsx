import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";
import type { WelcomeEmailProps } from "../../types";
import { BaseLayout } from "../shared/base-layout";

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <BaseLayout previewText={`Welcome to StackMatch, ${name}!`}>
      <Section style={contentStyle}>
        <Text style={headingStyle}>Welcome to StackMatch!</Text>
        <Text style={paragraphStyle}>Hi {name},</Text>
        <Text style={paragraphStyle}>
          Thanks for joining StackMatch. You can now analyze your GitHub repositories, discover your
          tech stack, and see how you compare with other developers.
        </Text>
        <Button href={EMAIL_URLS.base} style={buttonStyle}>
          Get Started
        </Button>
      </Section>
    </BaseLayout>
  );
}

export default WelcomeEmail;

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
