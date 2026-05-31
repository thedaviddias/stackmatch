import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Code2, Crown, Hash, Link2, Search } from "lucide-react";
import type { Metadata } from "next";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { TopicOwnersSection } from "@/components/pages/topic/topic-owners-section";
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
  const topic = decodeURIComponent(name);
  return createMetadata({
    title: i18n.metadata.pages.topic.title(topic),
    description: i18n.metadata.pages.topic.description(topic),
    path: ROUTES.topic(topic),
    keywords: i18n.metadata.pages.topic.keywords(topic),
  });
}

export default async function TopicPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const topic = decodeURIComponent(name).toLowerCase();
  const data = await fetchQuery(api.queries.stack.getTopicPageData, { topic });

  if (!data) {
    return (
      <div className="relative min-h-screen">
        <script type="application/ld+json">
          {JSON.stringify(
            createWebPageJsonLd({
              name: i18n.metadata.pages.topic.title(topic),
              path: ROUTES.topic(topic),
              description: i18n.metadata.pages.topic.description(topic),
            })
          )}
        </script>

        <BackgroundOrbs />
        <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-24 sm:px-6 text-center">
          <div className="inline-flex size-20 items-center justify-center rounded-3xl bg-neutral-900 border border-neutral-800 text-4xl mb-6 text-neutral-500">
            <Search className="size-10" />
          </div>
          <h1 className="text-3xl font-black text-white">Topic not found</h1>
          <p className="text-neutral-400 max-w-md mx-auto">
            No data available for{" "}
            <code className="rounded bg-neutral-800 px-2 py-0.5 text-th-accent-1-text font-mono">
              #{topic}
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
        {/* ── Topic Header ────────────────────────────────────────── */}
        <section className="rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
              <Hash className="size-3" />
              Topic
            </div>
            <h1 className="break-words text-4xl font-black leading-tight tracking-tighter text-white sm:text-5xl">
              #{data.topic}
            </h1>
            <p className="max-w-2xl text-base leading-normal text-neutral-400 font-medium sm:text-lg sm:leading-relaxed">
              Developers and organizations tagged with #{data.topic} on GitHub.
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
            <p className="text-[10px] font-bold text-neutral-500 mt-1">tagged #{data.topic}</p>
          </div>
        </section>

        {/* ── Top Stackers ────────────────────────────────────────── */}
        <section className="space-y-8">
          <SectionTitle
            variant="h2"
            title="Top Stackers"
            description={`Developers with #${data.topic} in their repositories.`}
            icon={Crown}
            iconClassName="text-amber-500"
          />

          {data.topOwners.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-800 p-20 text-center">
              <p className="text-neutral-500 font-bold">No stackers found for this topic yet.</p>
            </div>
          ) : (
            <TopicOwnersSection
              topic={data.topic}
              serverTopOwners={data.topOwners}
              serverTopOwnersCount={data.topOwnersCount}
            />
          )}
        </section>

        {/* ── Common Languages ────────────────────────────────────── */}
        {data.commonLanguages.length > 0 && (
          <section className="space-y-8">
            <SectionTitle
              variant="h2"
              title="Common Languages"
              description={`Programming languages frequently used with #${data.topic}.`}
              icon={Code2}
              iconClassName="text-emerald-500"
            />
            <div className="flex min-w-0 flex-wrap gap-3 px-2">
              {data.commonLanguages.map((l) => (
                <LinkCustom
                  key={l.language}
                  href={ROUTES.language(l.language)}
                  className="group relative flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-emerald-900/30 bg-emerald-500/5 px-4 py-3 text-sm font-bold text-emerald-300 transition-all hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-200 hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] sm:gap-3 sm:px-5"
                >
                  <span className="min-w-0 break-all">{l.language}</span>
                  <div className="h-4 w-px bg-emerald-800/30" />
                  <span className="text-[10px] font-black text-emerald-500/60 tabular-nums">
                    {l.coOccurrenceCount}
                  </span>
                </LinkCustom>
              ))}
            </div>
          </section>
        )}

        {/* ── Related Topics ──────────────────────────────────────── */}
        {data.relatedTopics.length > 0 && (
          <section className="space-y-8">
            <SectionTitle
              variant="h2"
              title="Related Topics"
              description={`Topics commonly found alongside #${data.topic}.`}
              icon={Link2}
              iconClassName="text-white"
            />
            <div className="flex flex-wrap gap-3 px-2">
              {data.relatedTopics.map((t) => (
                <LinkCustom
                  key={t.topic}
                  href={ROUTES.topic(t.topic)}
                  className="group relative flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 py-3 text-sm font-bold text-neutral-300 transition-all hover:-translate-y-1 hover:border-[var(--theme-hover-border)] hover:bg-neutral-900 hover:text-white hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.1)]"
                >
                  <span className="text-th-accent-1 group-hover:scale-125 transition-transform">
                    #
                  </span>
                  {t.topic}
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
