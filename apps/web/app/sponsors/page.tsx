import { ROUTES } from "@stackmatch/config";
import { BarChart3, CheckCircle2, Handshake, Network, PackageSearch, Shield } from "lucide-react";
import Link from "next/link";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "Sponsor Stackmatch | Founding Sponsor Program",
  description:
    "Become an early Stackmatch sponsor and help shape developer ecosystem discovery from public stack signals.",
  path: ROUTES.sponsors,
});

const SPONSOR_TIERS = [
  {
    title: "Founding Sponsor",
    price: "Early access",
    description:
      "Support the launch and help shape the first sponsor surfaces before formal packages exist.",
    features: ["Early sponsor badge", "Feedback calls", "Public thank-you placement"],
  },
  {
    title: "Ecosystem Pilot",
    price: "Limited",
    description:
      "Explore one package or category with lightweight public-signal notes and product feedback.",
    features: ["One package/community focus", "Qualitative findings", "Privacy-safe boundaries"],
  },
  {
    title: "Verified Org Pilot",
    price: "Invite-only",
    description:
      "Test organization verification and help define what company profiles should become.",
    features: ["Verified org badge", "Public profile review", "CTA and positioning feedback"],
  },
] as const;

const REPORT_EXAMPLES = [
  "Which public stacks already overlap with our tool?",
  "Which package pages should exist first?",
  "What would make verified org profiles useful?",
  "Which sponsor placements feel helpful instead of noisy?",
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
                Help shape Stackmatch while the ecosystem is still forming.
              </h1>
              <p className="max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
                Stackmatch just launched. Founding sponsors support the project early, get a close
                look at public stack signals, and help define useful sponsor surfaces before we turn
                them into formal packages.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={ROUTES.legal.contact}
                className="rounded-full bg-foreground px-5 py-3 text-xs font-black uppercase tracking-widest text-background transition-opacity hover:opacity-85"
              >
                Start sponsor conversation
              </Link>
              <Link
                href={ROUTES.companies}
                className="rounded-full border border-border px-5 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted"
              >
                DevTools overview
              </Link>
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
                Today, sponsors get direct involvement, early visibility, and a chance to shape the
                first package, organization, and community surfaces. Formal paid inventory comes
                after usage proves which pages people actually value.
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
