import { Column, Heading, Img, Row, Section, Text } from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";
import { ActionButton } from "../shared/action-button";
import { BaseLayout } from "../shared/base-layout";

interface StarEmailProps {
  name: string;
  actorHandle: string;
  actorAvatar: string;
  powerScore: number;
}

export function StarEmail({
  name,
  actorHandle,
  actorAvatar,
  powerScore,
}: StarEmailProps) {
  const profileUrl = `${EMAIL_URLS.base}/${actorHandle}`;

  return (
    <BaseLayout previewText={`@${actorHandle} just starred your technical stack!`}>
      <Heading style={h1Style}>You were starred.</Heading>

      <Text style={textStyle}>
        Hi {name}, @{actorHandle} just starred your stack and contributions this week.
      </Text>

      <Section style={actorCardStyle}>
        <Row>
          <Column style={{ width: "60px" }}>
            <Img src={actorAvatar} width="48" height="48" alt={actorHandle} style={avatarStyle} />
          </Column>
          <Column>
            <Text style={handleStyle}>@{actorHandle}</Text>
            <Text style={subHandleStyle}>Starred your technical DNA</Text>
          </Column>
        </Row>
      </Section>

      <Section style={statsContainerStyle}>
        <Text style={scoreLabelStyle}>Your Current Stack Score</Text>
        <Text style={scoreStyle}>{powerScore}</Text>
        <Text style={scoreSubtextStyle}>Top 5% of React developers this month</Text>
      </Section>

      <Section style={buttonContainerStyle}>
        <ActionButton href={profileUrl}>Star @{actorHandle} back</ActionButton>
      </Section>

      <Text style={subtextStyle}>
        Stars help build your reputation in the collaboration graph. Highly starred
        developers get priority matching for new projects.
      </Text>
    </BaseLayout>
  );
}

export default StarEmail;

const h1Style = {
  color: EMAIL_BRAND.text,
  fontSize: "28px",
  fontWeight: "900",
  margin: "0 0 20px",
  letterSpacing: "-0.02em",
};

const textStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 24px",
};

const actorCardStyle = {
  backgroundColor: EMAIL_BRAND.background,
  borderRadius: "16px",
  padding: "20px",
  border: `1px solid ${EMAIL_BRAND.border}`,
  marginBottom: "32px",
};

const avatarStyle = {
  borderRadius: "10px",
};

const handleStyle = {
  fontSize: "18px",
  fontWeight: "800",
  color: EMAIL_BRAND.text,
  margin: "0 0 2px 12px",
};

const subHandleStyle = {
  fontSize: "13px",
  color: EMAIL_BRAND.mutedText,
  margin: "0 0 0 12px",
};

const statsContainerStyle = {
  textAlign: "center" as const,
  backgroundColor: "#1e1b4b", // Brand secondary
  borderRadius: "16px",
  padding: "32px",
  marginBottom: "32px",
};

const scoreLabelStyle = {
  color: "rgba(255,255,255,0.5)",
  fontSize: "11px",
  fontWeight: "900",
  textTransform: "uppercase" as const,
  letterSpacing: "0.2em",
  margin: "0 0 8px",
};

const scoreStyle = {
  color: "#fff",
  fontSize: "64px",
  fontWeight: "900",
  margin: "0",
  lineHeight: "1",
};

const scoreSubtextStyle = {
  color: "#818cf8", // indigo-400
  fontSize: "13px",
  fontWeight: "600",
  margin: "8px 0 0",
};

const buttonContainerStyle = {
  textAlign: "center" as const,
  marginBottom: "32px",
};

const subtextStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  textAlign: "center" as const,
};
