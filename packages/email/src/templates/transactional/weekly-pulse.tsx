import { Column, Heading, Hr, Link, Row, Section, Text } from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";
import { ActionButton } from "../shared/action-button";
import { BaseLayout } from "../shared/base-layout";

interface WeeklyStackPulseEmailProps {
  name: string;
  matchCount: number;
  trendingPackages: Array<{ name: string; growth: number }>;
  topMatchedPeers: Array<{ handle: string; avatar: string }>;
  globalStats: {
    totalDevelopers: string;
    newRepos: number;
  };
}

export function WeeklyStackPulseEmail({
  name,
  matchCount,
  trendingPackages,
  topMatchedPeers,
  globalStats,
}: WeeklyStackPulseEmailProps) {
  const dashboardUrl = `${EMAIL_URLS.base}/feed`;

  return (
    <BaseLayout previewText={`Your Weekly Stack Pulse: ${matchCount} new matches and more.`}>
      <Heading style={h1Style}>Weekly Stack Pulse.</Heading>

      <Text style={textStyle}>
        Hi {name}, here is your personalized collaboration summary for this week on stackmatch.dev.
      </Text>

      {/* New Matches Section */}
      <Section style={sectionStyle}>
        <Text style={labelStyle}>New Matches This Week</Text>
        <div style={matchContainerStyle}>
          <Text style={matchCountStyle}>{matchCount}</Text>
          <Text style={matchSubtextStyle}>High-affinity developers identified</Text>
        </div>
        <Row style={{ marginTop: "16px" }}>
          {topMatchedPeers.map((peer) => (
            <Column key={peer.handle} style={{ paddingRight: "12px" }}>
              <Link href={`${EMAIL_URLS.base}/${peer.handle}`}>
                <img
                  src={peer.avatar}
                  width="40"
                  height="40"
                  alt={peer.handle}
                  style={{ borderRadius: "8px", border: `1px solid ${EMAIL_BRAND.border}` }}
                />
              </Link>
            </Column>
          ))}
        </Row>
      </Section>

      <Hr style={hrStyle} />

      {/* Trending Packages Section */}
      <Section style={sectionStyle}>
        <Text style={labelStyle}>Trending in Your Network</Text>
        <Text style={subLabelStyle}>
          Packages frequently added by developers with similar stacks:
        </Text>
        {trendingPackages.map((pkg) => (
          <div key={pkg.name} style={pkgRowStyle}>
            <Text style={pkgNameStyle}>{pkg.name}</Text>
            <Text style={pkgGrowthStyle}>+{pkg.growth}% adoption</Text>
          </div>
        ))}
      </Section>

      <Hr style={hrStyle} />

      {/* Global Community Section */}
      <Section style={sectionStyle}>
        <Row>
          <Column>
            <Text style={statValueStyle}>{globalStats.totalDevelopers}</Text>
            <Text style={statLabelStyle}>Engineers Indexed</Text>
          </Column>
          <Column>
            <Text style={statValueStyle}>+{globalStats.newRepos}</Text>
            <Text style={statLabelStyle}>New Repositories</Text>
          </Column>
        </Row>
      </Section>

      <Section style={buttonContainerStyle}>
        <ActionButton href={dashboardUrl}>Open Your Dashboard</ActionButton>
      </Section>

      <Text style={subtextStyle}>
        You are receiving this because you opted into weekly summaries. Adjust your{" "}
        <Link href={`${EMAIL_URLS.base}/settings/notifications`} style={linkStyle}>
          notification preferences
        </Link>{" "}
        anytime.
      </Text>
    </BaseLayout>
  );
}

export default WeeklyStackPulseEmail;

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
  margin: "0 0 32px",
};

const sectionStyle = {
  margin: "0 0 24px",
};

const labelStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "14px",
  fontWeight: "900",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
  margin: "0 0 16px",
};

const subLabelStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "13px",
  margin: "0 0 16px",
};

const matchContainerStyle = {
  backgroundColor: "#f8fafc",
  borderRadius: "12px",
  padding: "20px",
  border: `1px solid ${EMAIL_BRAND.border}`,
};

const matchCountStyle = {
  fontSize: "32px",
  fontWeight: "900",
  color: EMAIL_BRAND.primary,
  margin: "0",
  lineHeight: "1",
};

const matchSubtextStyle = {
  fontSize: "14px",
  fontWeight: "600",
  color: EMAIL_BRAND.mutedText,
  margin: "4px 0 0",
};

const hrStyle = {
  borderColor: EMAIL_BRAND.border,
  margin: "32px 0",
};

const pkgRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
};

const pkgNameStyle = {
  fontSize: "14px",
  fontWeight: "700",
  color: EMAIL_BRAND.text,
  margin: "0",
};

const pkgGrowthStyle = {
  fontSize: "12px",
  fontWeight: "800",
  color: "#10b981",
  margin: "0",
};

const statValueStyle = {
  fontSize: "24px",
  fontWeight: "900",
  color: EMAIL_BRAND.text,
  margin: "0",
};

const statLabelStyle = {
  fontSize: "11px",
  fontWeight: "700",
  color: EMAIL_BRAND.mutedText,
  textTransform: "uppercase" as const,
  margin: "4px 0 0",
};

const buttonContainerStyle = {
  textAlign: "center" as const,
  margin: "40px 0 32px",
};

const subtextStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  textAlign: "center" as const,
};

const linkStyle = {
  color: EMAIL_BRAND.primary,
  textDecoration: "underline",
};
