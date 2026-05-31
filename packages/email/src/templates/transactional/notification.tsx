import { Button, Section, Text } from "@react-email/components";
import { EMAIL_BRAND } from "../../keys";
import type { NotificationEmailProps } from "../../types";
import { BaseLayout } from "../shared/base-layout";

export function NotificationEmail({ name, title, message, action }: NotificationEmailProps) {
  return (
    <BaseLayout previewText={title}>
      <Section>
        <Text style={headingStyle}>{title}</Text>
        <Text style={paragraphStyle}>Hi {name},</Text>
        <Text style={paragraphStyle}>{message}</Text>
        {action && (
          <Section style={buttonContainerStyle}>
            <Button href={action.url} style={buttonStyle}>
              {action.label}
            </Button>
          </Section>
        )}
      </Section>
    </BaseLayout>
  );
}

export default NotificationEmail;

const headingStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "20px",
  fontWeight: "700" as const,
  lineHeight: "28px",
  margin: "0 0 12px",
};

const paragraphStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const buttonContainerStyle = {
  marginTop: "24px",
};

const buttonStyle = {
  backgroundColor: EMAIL_BRAND.primary,
  borderRadius: "6px",
  color: EMAIL_BRAND.white,
  display: "inline-block" as const,
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "12px 20px",
  textDecoration: "none",
  textAlign: "center" as const,
};
