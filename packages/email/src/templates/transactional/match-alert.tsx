import { Column, Heading, Img, Row, Section, Text } from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";
import { ActionButton } from "../shared/action-button";
import { BaseLayout } from "../shared/base-layout";

interface MatchAlertEmailProps {
  name: string;
  matchedHandle: string;
  matchedAvatar: string;
  affinityScore: number;
  sharedPackages: string[];
}

export function MatchAlertEmail({
  name,
  matchedHandle,
  matchedAvatar,
  affinityScore,
  sharedPackages,
}: MatchAlertEmailProps) {
  const profileUrl = `${EMAIL_URLS.base}/${matchedHandle}`;
  const pct = Math.round(affinityScore * 100);

  return (
    <BaseLayout previewText={`@${matchedHandle} matches ${pct}% of your technical stack!`}>
      <Heading style={h1Style}>New Match Found.</Heading>

      <Text style={textStyle}>
        Hi {name}, our collaboration engine just identified a high-affinity counterpart for your
        stack.
      </Text>

      <Section style={matchCardStyle}>
        <Row>
          <Column style={{ width: "80px" }}>
            <Img
              src={matchedAvatar}
              width="64"
              height="64"
              alt={matchedHandle}
              style={avatarStyle}
            />
          </Column>
          <Column>
            <Text style={handleStyle}>@{matchedHandle}</Text>
            <div style={badgeStyle}>
              <span style={dotStyle}>●</span> {pct}% Affinity
            </div>
          </Column>
        </Row>
      </Section>

      <Section style={packagesContainerStyle}>
        <Text style={labelStyle}>Shared Dependencies:</Text>
        <div style={tagsStyle}>
          {sharedPackages.slice(0, 6).map((pkg) => (
            <span key={pkg} style={tagStyle}>
              {pkg}
            </span>
          ))}
          {sharedPackages.length > 6 && (
            <span style={tagMoreStyle}>+ {sharedPackages.length - 6} more</span>
          )}
        </div>
      </Section>

      <Section style={buttonContainerStyle}>
        <ActionButton href={profileUrl}>View Collaboration Profile</ActionButton>
      </Section>

      <Text style={subtextStyle}>
        Matched based on your real-world contribution patterns and package.json history.
      </Text>
    </BaseLayout>
  );
}

export default MatchAlertEmail;

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

const matchCardStyle = {
  backgroundColor: EMAIL_BRAND.background,
  borderRadius: "16px",
  padding: "24px",
  border: `1px solid ${EMAIL_BRAND.border}`,
  marginBottom: "24px",
};

const avatarStyle = {
  borderRadius: "12px",
  border: `2px solid ${EMAIL_BRAND.white}`,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

const handleStyle = {
  fontSize: "20px",
  fontWeight: "900",
  color: EMAIL_BRAND.text,
  margin: "0 0 4px 12px",
};

const badgeStyle = {
  backgroundColor: "rgba(16, 185, 129, 0.1)",
  border: "1px solid rgba(16, 185, 129, 0.2)",
  borderRadius: "99px",
  padding: "2px 10px",
  display: "inline-block",
  fontSize: "11px",
  fontWeight: "900",
  textTransform: "uppercase" as const,
  color: "#10b981",
  marginLeft: "12px",
};

const dotStyle = {
  fontSize: "14px",
  marginRight: "4px",
  lineHeight: "1",
};

const packagesContainerStyle = {
  marginBottom: "32px",
};

const labelStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "12px",
  fontWeight: "800",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  margin: "0 0 12px",
};

const tagsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: "8px",
};

const tagStyle = {
  backgroundColor: "#f4f4f5",
  border: "1px solid #e4e4e7",
  borderRadius: "6px",
  padding: "4px 10px",
  fontSize: "12px",
  fontWeight: "600",
  color: "#3f3f46",
  margin: "0 4px 4px 0",
  display: "inline-block",
};

const tagMoreStyle = {
  fontSize: "12px",
  fontWeight: "600",
  color: EMAIL_BRAND.mutedText,
  display: "inline-block",
  padding: "4px 0",
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
