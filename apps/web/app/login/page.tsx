import { ROUTES } from "@stackmatch/config";
import type { Metadata } from "next";
import { LoginContent } from "@/app/login/login-content";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata } from "@/lib/re-exports/seo";

const i18n = getI18n();

export const metadata: Metadata = createMetadata({
  title: i18n.metadata.pages.login.title,
  description: i18n.metadata.pages.login.description,
  path: ROUTES.login,
  noIndex: true,
});

export default function LoginPage() {
  return <LoginContent />;
}
