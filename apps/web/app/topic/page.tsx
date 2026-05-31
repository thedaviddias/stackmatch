import { ROUTES } from "@stackmatch/config";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata } from "@/lib/re-exports/seo";

const copy = getI18n();

export const metadata = createMetadata({
  title: copy.metadata.pages.topics.title,
  description: copy.metadata.pages.topics.description,
  path: ROUTES.topics,
  noIndex: true,
});

export default function TopicIndexPage() {
  redirect(ROUTES.topics);
}
