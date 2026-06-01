import { Heading, Section, Text } from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";
import type { WelcomeEmailProps } from "../../types";
import { ActionButton } from "../shared/action-button";
import { BaseLayout } from "../shared/base-layout";

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <BaseLayout previewText={`Welcome to Stackmatch, ${name}. A quick note from David.`}>
      <Section>
        <Heading style={headingStyle}>Welcome to Stackmatch</Heading>
        <Text style={paragraphStyle}>Hi {name},</Text>
        <Text style={paragraphStyle}>
          I&apos;m David, the person building Stackmatch. Thanks for signing in and giving it a try.
        </Text>
        <Text style={paragraphStyle}>
          Stackmatch turns your GitHub activity into a practical map of your stack: the packages,
          languages, and communities you actually work with. From there, it helps you find
          developers who share real technical overlap with you.
        </Text>
        <Text style={paragraphStyle}>
          A good first step is to open your profile, review your stack, and see who you match with.
        </Text>
        <Section style={buttonContainerStyle}>
          <ActionButton href={EMAIL_URLS.base}>Open Stackmatch</ActionButton>
        </Section>
        <Text style={signatureStyle}>
          See you inside,
          <br />
          David
          <br />
          Founder, Stackmatch
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default WelcomeEmail;

const headingStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "24px",
  fontWeight: "800" as const,
  lineHeight: "32px",
  margin: "0 0 16px",
};

const paragraphStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const buttonContainerStyle = {
  marginTop: "24px",
};

const signatureStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "28px 0 0",
};
