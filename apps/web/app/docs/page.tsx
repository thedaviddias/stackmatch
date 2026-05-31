import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import Content from "./content.mdx";

const title = "About Stackmatch";
const description =
  "How Stackmatch identifies developers with similar stacks and builds unique dependency fingerprints.";

export const metadata = createMetadata({
  title,
  description,
  path: "/docs",
  keywords: [
    "stack fingerprints",
    "how Stackmatch works",
    "JavaScript package matching",
    "dependency graph analysis",
  ],
});

export default function DocsPage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(createWebPageJsonLd({ name: title, path: "/docs", description }))}
      </script>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Stackmatch</h1>
      <Content />
    </>
  );
}
