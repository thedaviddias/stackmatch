import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Suspense } from "react";
import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { StacksDirectoryContent } from "@/components/pages/stacks/stacks-directory-content";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

const copy = getI18n();

export const metadata = createMetadata({
  title: copy.metadata.pages.stacks.title,
  description: copy.metadata.pages.stacks.description,
  path: ROUTES.stacks,
  keywords: copy.metadata.pages.stacks.keywords,
});

export default function StacksPage() {
  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-[var(--theme-selection-bg)]">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: copy.metadata.pages.stacks.title,
            path: ROUTES.stacks,
            description: copy.metadata.pages.stacks.description,
          })
        )}
      </script>

      <BackgroundOrbs />

      <main className="mx-auto max-w-app px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
        <SectionTitle
          variant="h1"
          title={copy.pages.stacks.title}
          description={copy.pages.stacks.description}
          eyebrow={copy.pages.stacks.eyebrow}
          spacing="md"
        />

        <Suspense fallback={null}>
          <StacksDirectoryContent />
        </Suspense>
      </main>
    </div>
  );
}
