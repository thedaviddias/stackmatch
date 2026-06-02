import { Button, Link, Section, Text } from "@react-email/components";
import { EMAIL_BRAND } from "../../keys";
import type { NotificationDigestEmailItem, NotificationDigestEmailProps } from "../../types";
import { BaseLayout } from "../shared/base-layout";

function normalizeDigestItem(
  item: string | NotificationDigestEmailItem
): NotificationDigestEmailItem {
  return typeof item === "string" ? { text: item } : item;
}

function renderDigestItem(item: NotificationDigestEmailItem) {
  if (!item.actorOwner || !item.actionUrl) {
    return item.text;
  }

  const mention = `@${item.actorOwner}`;
  const mentionIndex = item.text.indexOf(mention);
  if (mentionIndex < 0) {
    return item.text;
  }

  return (
    <>
      {item.text.slice(0, mentionIndex)}
      <Link href={item.actionUrl} style={itemLinkStyle}>
        {mention}
      </Link>
      {item.text.slice(mentionIndex + mention.length)}
    </>
  );
}

export function NotificationDigestEmail({
  name,
  title,
  summary,
  count,
  items,
  action,
}: NotificationDigestEmailProps) {
  const summaryText =
    summary ?? `You have ${count} new Stackmatch update${count === 1 ? "" : "s"}`;

  return (
    <BaseLayout previewText={title}>
      <Section>
        <Text style={headingStyle}>{title}</Text>
        <Text style={paragraphStyle}>Hi {name},</Text>
        <Text style={paragraphStyle}>{summaryText}:</Text>
        {items.map((rawItem) => {
          const item = normalizeDigestItem(rawItem);
          return (
            <Text key={item.text} style={itemStyle}>
              • {renderDigestItem(item)}
            </Text>
          );
        })}
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

export default NotificationDigestEmail;

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

const itemStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 10px",
};

const itemLinkStyle = {
  color: EMAIL_BRAND.primary,
  fontWeight: "600" as const,
  textDecoration: "underline",
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
