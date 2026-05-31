import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { EMAIL_BRAND, EMAIL_URLS } from "../../keys";

type SectionChildren = NonNullable<Parameters<typeof Section>[0]>["children"];

interface BaseLayoutProps {
  previewText: string;
  children: SectionChildren;
}

export function BaseLayout({ previewText, children }: BaseLayoutProps) {
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={mainStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Link href={EMAIL_URLS.base} style={logoLinkStyle}>
              <Text style={logoTextStyle}>stackmatch.dev</Text>
            </Link>
          </Section>

          {/* Main Content */}
          <Section style={contentContainerStyle}>{children}</Section>

          {/* Footer */}
          <Hr style={hrStyle} />
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              &copy; {currentYear} stackmatch.dev. Built for the engineering ecosystem.
            </Text>
            <Text style={footerSubTextStyle}>
              You received this because you are a member of the stackmatch community.
            </Text>
            <div style={footerLinksStyle}>
              <Link href={`${EMAIL_URLS.base}${EMAIL_URLS.unsubscribe}`} style={footerLinkStyle}>
                Unsubscribe
              </Link>
              <span style={footerSeparatorStyle}>&bull;</span>
              <Link href={EMAIL_URLS.base} style={footerLinkStyle}>
                Platform
              </Link>
              <span style={footerSeparatorStyle}>&bull;</span>
              <Link href="https://github.com/thedaviddias" style={footerLinkStyle}>
                GitHub
              </Link>
            </div>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const mainStyle = {
  backgroundColor: EMAIL_BRAND.background,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const containerStyle = {
  margin: "0 auto",
  maxWidth: "600px",
  padding: "24px 12px 48px",
};

const headerStyle = {
  padding: "12px 0 24px",
};

const logoLinkStyle = {
  textDecoration: "none",
};

const logoTextStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "18px",
  fontWeight: "800",
  margin: "0",
  letterSpacing: "-0.03em",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
};

const contentContainerStyle = {
  backgroundColor: EMAIL_BRAND.white,
  border: `1px solid ${EMAIL_BRAND.border}`,
  borderRadius: "12px",
  padding: "32px 24px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const hrStyle = {
  borderColor: EMAIL_BRAND.border,
  margin: "32px 0",
};

const footerStyle = {
  textAlign: "center" as const,
};

const footerTextStyle = {
  color: EMAIL_BRAND.text,
  fontSize: "12px",
  fontWeight: "600",
  margin: "0 0 8px",
};

const footerSubTextStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "11px",
  margin: "0 0 16px",
};

const footerLinksStyle = {
  color: EMAIL_BRAND.mutedText,
  fontSize: "11px",
};

const footerLinkStyle = {
  color: EMAIL_BRAND.mutedText,
  textDecoration: "underline",
};

const footerSeparatorStyle = {
  margin: "0 8px",
  color: EMAIL_BRAND.border,
};
