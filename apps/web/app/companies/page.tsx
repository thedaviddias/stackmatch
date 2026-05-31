import { ROUTES } from "@stackmatch/config";
import { BarChart3, Building2, Network, PackageSearch, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "For DevTools Companies | Stackmatch",
  description:
    "Use Stackmatch to understand public package adoption, adjacent stack communities, and developers already building near your ecosystem.",
  path: ROUTES.companies,
});

const INTELLIGENCE_CARDS = [
  {
    title: "Ecosystem discovery",
    description:
      "Explore developers, organizations, and repos already using packages near your stack.",
    icon: Network,
  },
  {
    title: "Package adoption",
    description: "Use public package manifests to spot early co-usage and community patterns.",
    icon: PackageSearch,
  },
  {
    title: "Developer cohorts",
    description:
      "Learn which developer cohorts may be worth supporting, interviewing, or inviting.",
    icon: Users,
  },
] as const;

const SPONSOR_SURFACES = [
  "Founding sponsor badge",
  "Package page pilot",
  "Verified organization pilot",
  "Qualitative ecosystem notes",
] as const;

const SAMPLE_REPORT_ROWS = [
  { label: "Package co-usage", value: "Pilot", trend: "Early" },
  { label: "Verified org profiles", value: "Pilot", trend: "Early" },
  { label: "Sponsor placements", value: "Testing", trend: "Early" },
] as const;

export default function CompaniesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: "For DevTools Companies",
            path: ROUTES.companies,
            description: "Ecosystem intelligence and developer activation for DevTools companies.",
          })
        )}
      </script>

      <section className="border-b border-border bg-card/40 px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/25 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
              <Building2 className="size-3.5" />
              For DevTools Companies
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Understand who is already building with your ecosystem.
              </h1>
              <p className="max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
                Stackmatch just launched. The first sponsor-friendly work is about validating which
                public stack signals help DevTools teams understand and support relevant builders.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={ROUTES.sponsors}
                className="rounded-full bg-foreground px-5 py-3 text-xs font-black uppercase tracking-widest text-background transition-opacity hover:opacity-85"
              >
                Sponsor Stackmatch
              </Link>
              <Link
                href={ROUTES.package("react")}
                className="rounded-full border border-border px-5 py-3 text-xs font-black uppercase tracking-widest text-foreground transition-colors hover:bg-muted"
              >
                View package signal
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 shadow-sm dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm font-black text-foreground">Launch-stage sponsor pilots</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Early surfaces to validate before formal packaging
                </p>
              </div>
              <BarChart3 className="size-5 text-th-accent-1" />
            </div>
            <div className="divide-y divide-border">
              {SAMPLE_REPORT_ROWS.map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto_auto] gap-4 py-4">
                  <span className="text-sm font-bold text-foreground">{row.label}</span>
                  <span className="font-mono text-sm font-black text-foreground">{row.value}</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {row.trend}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            {INTELLIGENCE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="rounded-2xl border border-border bg-card/70 p-5 dark:bg-white/[0.03]"
                >
                  <Icon className="size-5 text-th-accent-1" />
                  <h2 className="mt-4 text-lg font-black text-foreground">{card.title}</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-border bg-card/70 p-6 dark:bg-white/[0.03]">
              <p className="flex items-center gap-2 text-sm font-black text-foreground">
                <ShieldCheck className="size-4 text-emerald-500" />
                Privacy Boundary
              </p>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
                Sponsor surfaces use public repository metadata and aggregate package signals.
                Private repository analysis remains opt-in, aggregate-only, and controlled by the
                individual GitHub account.
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-card/70 p-6 dark:bg-white/[0.03]">
              <p className="text-sm font-black text-foreground">Sponsor surfaces</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SPONSOR_SURFACES.map((surface) => (
                  <div
                    key={surface}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground dark:bg-black/20"
                  >
                    {surface}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
