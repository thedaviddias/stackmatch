import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import Content from "./content.mdx";

const title = "Terms";
const description = "Terms for using Stackmatch public alpha.";

export const metadata = createMetadata({
  title,
  description,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(createWebPageJsonLd({ name: title, path: "/terms", description }))}
      </script>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms</h1>
      <Content />
    </>
  );
}
