import { ROUTES, siteConfig } from "@stackmatch/config";
import { Code2, FlaskConical, Mail, ShieldCheck } from "lucide-react";
import { LegalPage } from "@/components/legal/legal-page";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import Content from "./content.mdx";

const title = "Terms";
const description = "Terms for using Stackmatch as a newly launched developer discovery service.";
const updated = "May 31, 2026";
const sourceUrl = ROUTES.external.github(
  siteConfig.sourceRepository.owner,
  siteConfig.sourceRepository.name
);

const facts = [
  { label: "Operator", value: siteConfig.ownerName },
  { label: "Mailing address", value: siteConfig.mailingAddress },
  { label: "Status", value: "Newly launched" },
] as const;

const highlights = [
  {
    title: "Launch notice",
    description:
      "Scans, rankings, package counts, and availability may change as Stackmatch improves.",
    icon: FlaskConical,
  },
  {
    title: "GitHub data",
    description: "You stay responsible for using GitHub and connected data within GitHub's terms.",
    icon: ShieldCheck,
  },
  {
    title: "Open source",
    description: "The source is MIT licensed; the hosted service remains governed by these terms.",
    icon: Code2,
  },
  {
    title: "Contact",
    description: `Questions and notices go to ${siteConfig.contactEmail}.`,
    icon: Mail,
  },
] as const;

const relatedLinks = [
  { label: "Privacy Policy", href: ROUTES.legal.privacy },
  { label: "Contact", href: ROUTES.legal.contact },
  { label: "Unsubscribe", href: ROUTES.legal.unsubscribe },
  { label: "GitHub source", href: sourceUrl },
] as const;

export const metadata = createMetadata({
  title,
  description,
  path: ROUTES.legal.terms,
});

export default function TermsPage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({ name: title, path: ROUTES.legal.terms, description })
        )}
      </script>
      <LegalPage
        title={title}
        eyebrow="Legal"
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
