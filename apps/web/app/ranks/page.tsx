import { ROUTES } from "@stackmatch/config";
import type { Metadata } from "next";
import { LinkCustom } from "@/components/ui/link";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata } from "@/lib/re-exports/seo";

const i18n = getI18n();

export const metadata: Metadata = createMetadata({
  title: i18n.metadata.pages.ranksLegacy.title,
  description: i18n.metadata.pages.ranksLegacy.description,
  path: ROUTES.docs.ranks,
  noIndex: true,
});

export default function RanksAliasPage() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-white">
        Docs Have Moved
      </h1>
      <p className="mt-4 text-muted-foreground dark:text-neutral-400">
        Developer ranks are now documented in the Docs section.
      </p>
      <LinkCustom
        href={ROUTES.docs.ranks}
        className="mt-8 inline-flex items-center rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:bg-foreground/85 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {i18n.actions.common.openDeveloperRanks}
      </LinkCustom>
    </div>
  );
}
