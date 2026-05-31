import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";
import Content from "./content.mdx";

const title = "Privacy";
const description =
  "How Stackmatch handles GitHub identity, default public repository scans, and opt-in private repository analysis.";

export const metadata = createMetadata({
  title,
  description,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(createWebPageJsonLd({ name: title, path: "/privacy", description }))}
      </script>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy</h1>
      <Content />
    </>
  );
}
