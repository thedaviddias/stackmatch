import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Code2, Crown, Hash, Search } from "lucide-react";
import type { Metadata } from "next";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { LanguageOwnersSection } from "@/components/pages/language/language-owners-section";
import { LinkCustom } from "@/components/ui/link";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

export const revalidate = 300;
const i18n = getI18n();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const language = decodeURIComponent(name);
  return createMetadata({
    title: i18n.metadata.pages.language.title(language),
    description: i18n.metadata.pages.language.description(language),
    path: ROUTES.language(language),
    keywords: i18n.metadata.pages.language.keywords(language),
  });
}

export default async function LanguagePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const language = decodeURIComponent(name).toLowerCase();
  const data = await fetchQuery(api.queries.stack.getLanguagePageData, { language });

  if (!data) {
    return (
      <div className="relative min-h-screen">
        <script type="application/ld+json">
          {JSON.stringify(
            createWebPageJsonLd({
              name: i18n.metadata.pages.language.title(language),
              path: ROUTES.language(language),
              description: i18n.metadata.pages.language.description(language),
            })
          )}
        </script>

        <BackgroundOrbs />
        <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-24 sm:px-6 text-center">
          <div className="inline-flex size-20 items-center justify-center rounded-3xl bg-neutral-900 border border-neutral-800 text-4xl mb-6 text-neutral-500">
            <Search className="size-10" />
          </div>
          <h1 className="text-3xl font-black text-white">Language not found</h1>
          <p className="text-neutral-400 max-w-md mx-auto">
            No data available for{" "}
            <code className="rounded bg-neutral-800 px-2 py-0.5 text-th-accent-1-text font-mono">
              {language}
            </code>
            . It may not have been scanned yet.
          </p>
          <div className="pt-8">
            <LinkCustom
              href={ROUTES.developers}
              className="rounded-full bg-white/5 border border-white/10 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10"
            >
              &larr; Back to Developers
            </LinkCustom>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]">
      <BackgroundOrbs />

      <div className="space-y-12 px-4 pb-24 pt-12 sm:px-6 lg:pt-16">
        {/* ── Language Header ─────────────────────────────────────── */}
        <section className="rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              <Code2 className="size-3" />
              Language
            </div>
            <h1 className="break-words text-4xl font-black leading-tight tracking-tighter text-white capitalize sm:text-5xl">
              {data.language}
            </h1>
            <p className="max-w-2xl text-base leading-normal text-neutral-400 font-medium sm:text-lg sm:leading-relaxed">
              Developers and organizations using {data.language} as a primary language.
            </p>
          </div>
        </section>

        {/* ── Key Stats ───────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-4">
          <div className="group rounded-3xl border border-neutral-800 glass-panel p-4 transition-all hover:-translate-y-1 hover:border-[var(--theme-hover-border)] sm:p-6">
            <p className="text-[10px] uppercase tracking-widest font-black text-neutral-500 group-hover:text-th-accent-1-text transition-colors">
              Stackers
            </p>
            <p className="mt-1 text-3xl font-black text-white sm:text-4xl">
              {data.totalOwnerCount}
            </p>
            <p className="text-[10px] font-bold text-neutral-500 mt-1">in stackmatch</p>
          </div>
          <div className="group rounded-3xl border border-neutral-800 glass-panel p-4 transition-all hover:-translate-y-1 hover:border-purple-500/30 sm:p-6">
            <p className="text-[10px] uppercase tracking-widest font-black text-neutral-500 group-hover:text-purple-400 transition-colors">
              Repos
            </p>
            <p className="mt-1 text-3xl font-black text-white sm:text-4xl">{data.totalRepoCount}</p>
            <p className="text-[10px] font-bold text-neutral-500 mt-1">using {data.language}</p>
          </div>
        </section>

        {/* ── Top Stackers ────────────────────────────────────────── */}
        <section className="space-y-8">
          <SectionTitle
            variant="h2"
            title="Top Stackers"
            description={`Developers with ${data.language} as a primary language.`}
            icon={Crown}
            iconClassName="text-amber-500"
          />

          {data.topOwners.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-800 p-20 text-center">
              <p className="text-neutral-500 font-bold">No stackers found for this language yet.</p>
            </div>
          ) : (
            <LanguageOwnersSection
              language={data.language}
              serverTopOwners={data.topOwners}
              serverTopOwnersCount={data.topOwnersCount}
            />
          )}
        </section>

        {/* ── Related Topics ──────────────────────────────────────── */}
        {data.relatedTopics.length > 0 && (
          <section className="space-y-8">
            <SectionTitle
              variant="h2"
              title="Common Topics"
              description={`GitHub topics frequently found alongside ${data.language}.`}
              icon={Hash}
              iconClassName="text-white"
            />
            <div className="flex min-w-0 flex-wrap gap-3 px-2">
              {data.relatedTopics.map((t) => (
                <LinkCustom
                  key={t.topic}
                  href={ROUTES.topic(t.topic)}
                  className="group relative flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm font-bold text-neutral-300 transition-all hover:-translate-y-1 hover:border-[var(--theme-hover-border)] hover:bg-neutral-900 hover:text-white hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.1)] sm:gap-3 sm:px-5"
                >
                  <span className="text-th-accent-1 group-hover:scale-125 transition-transform">
                    #
                  </span>
                  <span className="min-w-0 break-all">{t.topic}</span>
                  <div className="h-4 w-px bg-neutral-800 group-hover:bg-th-accent-1/20" />
                  <span className="text-[10px] font-black text-neutral-500 tabular-nums">
                    {t.coOccurrenceCount}
                  </span>
                </LinkCustom>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
