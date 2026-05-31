import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import Content from "./content.mdx";

const title = "Stacker Ranks";
const description = "Learn how the Stack Score works and how to level up your engineering profile.";

export const metadata = createMetadata({
  title,
  description,
  path: "/docs/ranks",
});

export default function RanksDocsPage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(createWebPageJsonLd({ name: title, path: "/docs/ranks", description }))}
      </script>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Stacker Ranks</h1>
      <Content />
    </>
  );
}
