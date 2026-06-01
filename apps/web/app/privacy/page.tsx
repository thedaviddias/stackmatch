import { ROUTES, siteConfig } from "@stackmatch/config";
import { Database, EyeOff, LockKeyhole, SlidersHorizontal, User } from "lucide-react";
import { LegalPage } from "@/components/legal/legal-page";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import Content from "./content.mdx";

const title = "Privacy";
const description =
  "How Stackmatch handles GitHub identity, default public repository scans, and opt-in private repository analysis.";
const updated = "May 31, 2026";

const facts = [
  { label: "Operator", value: siteConfig.ownerName },
  { label: "Mailing address", value: siteConfig.mailingAddress },
  { label: "Contact", value: siteConfig.contactEmail },
] as const;

const highlights = [
  {
    title: "GitHub identity",
    description: "Sign-in identifies your GitHub account and claims your Stackmatch profile.",
    icon: User,
  },
  {
    title: "Public scans",
    description:
      "Public repository package manifests are analyzed by default for stack fingerprints.",
    icon: Database,
  },
  {
    title: "Private opt-in",
    description: "Private repository analysis requires an explicit GitHub App installation.",
    icon: LockKeyhole,
  },
  {
    title: "No source storage",
    description:
      "Stackmatch does not store source code, private file paths, or private repo names.",
    icon: EyeOff,
  },
  {
    title: "Profile controls",
    description: "Visibility and private aggregate data controls live in your Stackmatch profile.",
    icon: SlidersHorizontal,
  },
] as const;

const relatedLinks = [
  { label: "Terms", href: ROUTES.legal.terms },
  { label: "Contact", href: ROUTES.legal.contact },
  { label: "Unsubscribe", href: ROUTES.legal.unsubscribe },
  { label: "Account settings", href: ROUTES.settings.account },
] as const;

export const metadata = createMetadata({
  title,
  description,
  path: ROUTES.legal.privacy,
});

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({ name: title, path: ROUTES.legal.privacy, description })
        )}
      </script>
      <LegalPage
        title={title}
        eyebrow="Privacy"
        description={description}
        updated={updated}
        facts={facts}
        highlights={highlights}
        links={relatedLinks}
      >
        <Content />
      </LegalPage>
    </>
  );
}
