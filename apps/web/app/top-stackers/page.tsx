import { ROUTES } from "@stackmatch/config";
import { Suspense } from "react";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { TopStackersDirectoryContent } from "@/components/pages/top-stackers/top-stackers-directory-content";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

const i18n = getI18n();

export const metadata = createMetadata({
  title: i18n.metadata.pages.topStackers.title,
  description: i18n.metadata.pages.topStackers.description,
  path: ROUTES.topStackers,
  keywords: i18n.metadata.pages.topStackers.keywords,
});

export default function TopStackersPage() {
  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: i18n.metadata.pages.topStackers.title,
            path: ROUTES.topStackers,
            description: i18n.metadata.pages.topStackers.description,
          })
        )}
      </script>

      <BackgroundOrbs />

      <main className="mx-auto max-w-app px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
        <header className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
            Weekly Leaderboard
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground dark:text-white sm:text-5xl">
            Top Stackers This Week
          </h1>
          <p className="max-w-3xl text-base font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
            Discover the most recognized developers and organizations for the current week.
          </p>
        </header>

        <Suspense fallback={null}>
          <TopStackersDirectoryContent />
        </Suspense>
      </main>
    </div>
  );
}
