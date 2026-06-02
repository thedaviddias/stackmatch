import { ROUTES } from "@stackmatch/config";
import { BarChart3, CheckCircle2, Handshake, Network, PackageSearch, Shield } from "lucide-react";
import { TrackedProductLink } from "@/components/analytics/tracked-product-link";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "Sponsor Stackmatch | Founding Sponsor Program",
  description:
    "Become an early Stackmatch sponsor and help shape developer ecosystem discovery from public stack signals.",
  path: ROUTES.sponsors,
});

const SPONSOR_TIERS = [
  {
    title: "Package Ecosystem Brief",
    price: "Early access",
    description:
      "Support a package page artifact that helps maintainers, DevRel teams, and developers understand public adoption.",
    features: ["Public adopter summary", "Adjacent package context", "Shareable brief"],
  },
  {
    title: "Verified Organization Profile",
    price: "Limited",
    description:
      "Verify organization ownership and connect maintained packages, public repos, and adopter communities.",
    features: ["Verified org badge", "Maintained package surface", "Public profile review"],
  },
  {
    title: "Sponsor Support Surface",
    price: "Invite-only",
    description:
      "Show ecosystem support without buying private access, inbox priority, or hidden lead data.",
    features: ["Transparent sponsor placement", "Supporter recognition", "Privacy-safe boundaries"],
  },
] as const;

const REPORT_EXAMPLES = [
  "Which public owners already depend on a package?",
  "Which packages appear beside it most often?",
  "Which maintained packages should connect to a verified org profile?",
  "Which sponsor surfaces help developers instead of interrupting them?",
] as const;

export default function SponsorsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: "Sponsor Stackmatch",
            path: ROUTES.sponsors,
            description: "Founding sponsorship for Stackmatch's launch-stage ecosystem product.",
          })
        )}
      </script>

      <section className="border-b border-border bg-card/40 px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/25 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
              <Handshake className="size-3.5" />
              Sponsor Stackmatch
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Support Stackmatch without compromising developer trust.
              </h1>
              <p className="max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
                Sponsors help keep the developer network free while getting transparent,
                public-signal surfaces around packages, organizations, and ecosystem support.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <TrackedProductLink
                href={ROUTES.legal.contact}
                cta="start_sponsor_conversation"
                surface="sponsors_page_hero"
                className="rounded-full bg-foreground px-5 py-3 text-xs font-black uppercase tracking-widest text-background transition-opacity hover:opacity-85"
              >
                Start sponsor conversation
              </TrackedProductLink>
              <TrackedProductLink
                href={ROUTES.companies}
                cta="devtools_overview"
                surface="sponsors_page_hero"
                className="rounded-full border border-border px-5 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted"
              >
                DevTools overview
              </TrackedProductLink>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 shadow-sm dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm font-black text-foreground">Early sponsor questions</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  What we want to validate with launch partners
                </p>
              </div>
              <BarChart3 className="size-5 text-th-accent-1" />
            </div>
            <div className="mt-5 grid gap-3">
              {REPORT_EXAMPLES.map((example) => (
                <div
                  key={example}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card/70 p-3"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <p className="text-sm font-bold text-foreground">{example}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {SPONSOR_TIERS.map((tier) => (
              <article
                key={tier.title}
                className="flex min-h-[320px] flex-col rounded-2xl border border-border bg-card/70 p-6 dark:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-foreground">{tier.title}</h2>
                    <p className="mt-1 text-xs font-black uppercase tracking-widest text-th-accent-1-text">
                      {tier.price}
                    </p>
                  </div>
                  <PackageSearch className="size-5 text-th-accent-1" />
                </div>
                <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground">
                  {tier.description}
                </p>
                <div className="mt-5 space-y-2">
                  {tier.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      {feature}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card/70 p-6 dark:bg-white/[0.03]">
              <p className="flex items-center gap-2 text-sm font-black text-foreground">
                <Network className="size-4 text-cyan-500" />
                What Sponsors Get
              </p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
                Sponsors get early visibility on package, organization, and community surfaces that
                are useful to developers first. Paid inventory stays tied to support and aggregate
                ecosystem insight, not private access.
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card/70 p-6 dark:bg-white/[0.03]">
              <p className="flex items-center gap-2 text-sm font-black text-foreground">
                <Shield className="size-4 text-emerald-500" />
                Privacy Boundary
              </p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
                Any sponsor-facing insight starts from public package metadata and aggregate counts.
                Private repo analysis remains separate, opt-in, aggregate-only, and controlled by
                each GitHub account.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
