import { ROUTES } from "@stackmatch/config";
import { redirect } from "next/navigation";
import { createMetadata } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "Settings",
  description: "Manage your StackMatch account settings.",
  path: "/settings",
  noIndex: true,
});

export default function SettingsIndexPage() {
  redirect(ROUTES.settings.account);
}
