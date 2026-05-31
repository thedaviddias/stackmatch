import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Suspense } from "react";
import { TopicsDirectoryContent } from "@/components/pages/topics/topics-directory-content";
import { listDistinctTopics } from "@/data/discovery";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

export const revalidate = 900;

const copy = getI18n();

export const metadata = createMetadata({
  title: copy.metadata.pages.topics.title,
  description: copy.metadata.pages.topics.description,
  path: ROUTES.topics,
  keywords: copy.metadata.pages.topics.keywords,
});

export default async function TopicsPage() {
  const topics = (await listDistinctTopics()).sort((a, b) => a.localeCompare(b));

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: copy.metadata.pages.topics.title,
            path: ROUTES.topics,
            description: copy.metadata.pages.topics.description,
          })
        )}
      </script>

      <main className="mx-auto max-w-app px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
        <SectionTitle
          variant="h1"
          title={copy.pages.topics.title}
          description={copy.pages.topics.description}
          eyebrow={copy.pages.topics.eyebrow}
          spacing="md"
        />

        <Suspense fallback={null}>
          <TopicsDirectoryContent topics={topics} />
        </Suspense>
      </main>
    </div>
  );
}
