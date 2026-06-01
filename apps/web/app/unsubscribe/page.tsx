import { ROUTES, siteConfig } from "@stackmatch/config";
import { Building2, Mail, ShieldCheck, UserMinus } from "lucide-react";
import { LegalPage } from "@/components/legal/legal-page";
import { LinkCustom } from "@/components/ui/link";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

const title = "Unsubscribe";
const description =
  "Manage Stackmatch email preferences and request removal from newsletter or product update emails.";
const updated = "June 1, 2026";
const unsubscribeEmailHref = `mailto:${siteConfig.contactEmail}?subject=Unsubscribe%20from%20Stackmatch%20emails`;

const facts = [
  { label: "Operator", value: siteConfig.ownerName },
  { label: "Mailing address", value: siteConfig.mailingAddress },
  { label: "Contact", value: siteConfig.contactEmail },
] as const;

const highlights = [
  {
    title: "Email preferences",
    description: "Ask to be removed from newsletter and product update email lists.",
    icon: UserMinus,
  },
  {
    title: "Account messages",
    description: "Important account, security, and service emails may still be sent when required.",
    icon: ShieldCheck,
  },
  {
    title: "Direct contact",
    description: `Unsubscribe requests go to ${siteConfig.contactEmail}.`,
    icon: Mail,
  },
  {
    title: "Legal sender",
    description: `${siteConfig.ownerName} operates Stackmatch from ${siteConfig.mailingAddress}.`,
    icon: Building2,
  },
] as const;

const relatedLinks = [
  { label: "Privacy Policy", href: ROUTES.legal.privacy },
  { label: "Terms", href: ROUTES.legal.terms },
  { label: "Contact", href: ROUTES.legal.contact },
] as const;

export const metadata = createMetadata({
  title,
  description,
  path: ROUTES.legal.unsubscribe,
});

export default function UnsubscribePage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({ name: title, path: ROUTES.legal.unsubscribe, description })
        )}
      </script>
      <LegalPage
        title={title}
        eyebrow="Email preferences"
        description={description}
        updated={updated}
        facts={facts}
        highlights={highlights}
        links={relatedLinks}
      >
        <h2>Unsubscribe from Stackmatch emails</h2>
        <p>
          To unsubscribe from newsletter or product update emails, email{" "}
          <LinkCustom href={unsubscribeEmailHref}>{siteConfig.contactEmail}</LinkCustom> and include
          the email address you want removed.
        </p>
        <p>
          Stackmatch may still send essential account, login, security, transactional, or service
          emails when they are needed to operate your account or respond to a request.
        </p>
        <p>
          Stackmatch is operated by {siteConfig.ownerName}. Our mailing address is{" "}
          {siteConfig.mailingAddress}.
        </p>
      </LegalPage>
    </>
  );
}
