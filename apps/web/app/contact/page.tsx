import { ROUTES, siteConfig } from "@stackmatch/config";
import { Building2, Code2, Mail, ShieldCheck } from "lucide-react";
import { LinkCustom } from "@/components/ui/link";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

const title = "Contact Stackmatch";
const description =
  "Contact Stackmatch for support, privacy requests, open-source questions, and David Dias Digital ownership details.";

const contactEmailHref = `mailto:${siteConfig.contactEmail}`;
const contactCards = [
  {
    title: "Support and feedback",
    description: "Send bug reports, product feedback, account questions, and public alpha notes.",
    icon: Mail,
    linkLabel: siteConfig.contactEmail,
    href: contactEmailHref,
  },
  {
    title: "Privacy and data requests",
    description:
      "Ask about GitHub identity, public repository scans, private sync, or profile visibility.",
    icon: ShieldCheck,
    linkLabel: "Review privacy details",
    href: ROUTES.legal.privacy,
  },
  {
    title: "Open-source questions",
    description:
      "Discuss contributions, the MIT-licensed source, or the public Stackmatch repository.",
    icon: Code2,
    linkLabel: "View GitHub source",
    href: ROUTES.external.github("thedaviddias", "stackmatch"),
  },
  {
    title: "Company ownership",
    description: `Stackmatch is operated as a ${siteConfig.ownerName} open-source project.`,
    icon: Building2,
    linkLabel: siteConfig.ownerName,
    href: siteConfig.ownerUrl,
  },
] as const;

export const metadata = createMetadata({
  title,
  description,
  path: ROUTES.legal.contact,
});

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: title,
            path: ROUTES.legal.contact,
            description,
          })
        )}
      </script>

      <section className="max-w-3xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
          Public alpha
        </div>
        <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl dark:text-white">
          Contact Stackmatch
        </h1>
        <p className="mt-5 text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
          Stackmatch is an MIT-licensed open-source project operated by{" "}
          <a
            href={siteConfig.ownerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground underline-offset-4 transition-colors hover:text-th-accent-1-text hover:underline dark:text-white"
          >
            {siteConfig.ownerName}
          </a>
          . For the fastest route, send public alpha support, privacy, and contribution questions to{" "}
          <LinkCustom
            href={contactEmailHref}
            className="font-semibold text-th-accent-1-text underline underline-offset-4"
          >
            {siteConfig.contactEmail}
          </LinkCustom>
          .
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {contactCards.map((card) => {
          const Icon = card.icon;
          const isExternal = card.href.startsWith("http");

          return (
            <div
              key={card.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-th-accent-1/20 bg-th-accent-1/10 text-th-accent-1-text">
                <Icon className="size-5" />
              </div>
              <h2 className="text-lg font-black text-foreground dark:text-white">{card.title}</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                {card.description}
              </p>
              {isExternal ? (
                <a
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex text-sm font-bold text-th-accent-1-text underline-offset-4 transition-colors hover:underline"
                >
                  {card.linkLabel}
                </a>
              ) : (
                <LinkCustom
                  href={card.href}
                  className="mt-4 inline-flex text-sm font-bold text-th-accent-1-text underline-offset-4 transition-colors hover:underline"
                >
                  {card.linkLabel}
                </LinkCustom>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
