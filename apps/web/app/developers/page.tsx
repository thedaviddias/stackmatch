import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Suspense } from "react";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { DevelopersDirectoryContent } from "@/components/pages/developers/developers-directory-content";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

const copy = getI18n();

export const metadata = createMetadata({
  title: copy.metadata.pages.developers.title,
  description: copy.metadata.pages.developers.description,
  path: ROUTES.developers,
  keywords: copy.metadata.pages.developers.keywords,
});

export default function DevelopersPage() {
  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: copy.metadata.pages.developers.title,
            path: ROUTES.developers,
            description: copy.metadata.pages.developers.description,
          })
        )}
      </script>

      <BackgroundOrbs />

      <main className="mx-auto max-w-app px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
        <SectionTitle
          variant="h1"
          title={copy.pages.developers.title}
          description={copy.pages.developers.description}
          eyebrow={copy.pages.developers.eyebrow}
          spacing="md"
        />

        <Suspense fallback={null}>
          <DevelopersDirectoryContent />
        </Suspense>
      </main>
    </div>
  );
}
